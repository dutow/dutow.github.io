---
layout: post
title:  "(Re)implementing offsetof"
date:   2020-01-08 20:47:10 +0100
excerpt_separator: <!--more-->
categories: fancy-dsl
---

C++ (and C) has a builtin macro called `offsetof`, which provides us with information about where a given type is located within the memory block of a struct or class.
Unfortunately, C++ also limits with which types this macro can be used:
Before C++17, using it with non POD types was undefined behavior.

With C++17 and later, the compilers can conditionally support it with any type, but this isn't required.
While both gcc and clang supports more, both also generates a friendly warning when it's used with a non POD type.

The syntax is also quite specific -- most likely because it's originally a C construct: `offsetof(T, field)`.
C++ also has a rarely used feature called [pointer to data member][PTDM] using a different syntax `&T::field`, and unfortunately these two can't interact - 
for example, we can't get use `offsetof` in metaprograms based on an already existing pointer to data member.

And that leaves a slightly different, but related question:
can we implement offsetof without actually using it?

<!--more-->

## Use case

I don't have anything strong enough that justifies the time I spent on this.
Implementing it in C+ gets rid of a warning -- but at the cost of increased complexity, and possibly introducing new bugs.
Probably not worth it.

I've also tested both my implementation, and the original `offsetof` with some extreme inputs.
While I've found (and fixed) several bugs in my code, I've discovered only issue with the builtin:
clang doesn't support ambigous and shadowed data members.
That is, if a struct has two members with the same name.

Even from this two, shadowing can be worked around - leaving ambigouity the only issue, which requires multiple inheritance:

```cpp
struct foo1{
    int i;
};

struct foo2{
    int i;
};

struct bar : public foo1, public foo2 {};
```
 
Which doesn't present a strong real world use case.

Another issue is that pointers to data members don't appear from nowhere:
the only way to create them is by writing them down at least once, the same as with offsetof usage.
In the far future, if C++ gets some kind of reflection, and if that actually returns constexpr pointers to data members, then maybe this could be a reason.
But I'm quite sure that at point C++ will also get a standard function similar to this.

I would say that this was a nice exercise, and I'm not sure if I'll actually use it.

## A note about memory layout

While this implementation is possibly standard compliant, that doesn't mean it's correct an all architechtures.

It is definitely correct on typical devices we use today, but pointer arithmetic can easily break on some more exotic systems.

Let me quote [this answer from Keith Thompson on stackoverflow][soarith]:

> I've actually worked on systems (Cray vector machines) where arithmetic on `uintptr_t` wouldn't necessarily work.
> The hardware had 64-bit words, with a machine address containing the address of a word.
> The Unix-like OS needed to support 8-bit bytes, so byte pointers (`void*`, `char*`) contained a word address with a 3-bit offset stored in the otherwise unused high-order 3 bits of the 64-bit word.
> Pointer/integer conversions simply copied the representation.
> The result was that adding 1 to a `char*` pointer would cause it to point to the next byte (with the offset handled in software), but converting to `uintptr_t` and adding 1 would cause it to point to the next word.

I didn't even think about how this code would work on a system like that.
Regardless, many things in the C++ standard exists or limited because systems like the above still exists somewhere.

## Earlier work

From my memory, this was as popular topic after C++11 as the counter macro reimplementation.
Unfortunately the only link I still have is the ["Working around offsetof limitations"][gist] gist.
It is an interesting read, including the comments.

My code is based on the code of Ross Bencina in one of the comments.

## The issue

Calculating the offsetof in a runtime function is simple:

```cpp
template <typename T1, typename T2>
inline std::ptrdiff_t offset_of(T1 T2::*member) {
    const T2 object {};
    return reinterpret_cast<char*>(std::addressof(object.*member)) -
           reinterpret_cast<char*>(std::addressof(object));
}
```

If we check the code on [godbolt][godbolt], we can also see that the function will return a number, the compiler knows the answer.

But that doesn't mean that it can tell us:
`reinterpret_cast` isn't allowed in a constexpr context, making this approach unusable there.
As a special case, any pointer can be converted to `void*` using `static_cast`, and then `void*` to `char*`.
Which is great, since `static_cast` is allowed in a `constexpr` function... except this special case.

If a program only needs `offsetof` for runtime direct memory access, this is an easy solution (for a possible issue and workaround, see the last section of this post).
Constexprness is only required if for some reason we need the value of the offset in the type system.

## The solution

The solution to this problem is in the comments on that gist:
While there is no way to implement a constexpr `offset_of` in C++11, later standards relaxed several restrictions on constexpr functions.
In particular, while dereferencing non-active union members is still forbidden, C++17 allows getting their address.
With this relaxation, we can define the following type:

```cpp
union U{
  char c; // a trivially initializable and small active member
  TMEMBER m[sizeof(T)/sizeof(M) + 1]; // type of the data member
  TSTRUCT o; // type of the struct
  constexpr U() : c(0) {}  // make c the active member
};
```

Then we can take the address of the data member and `m[idx]`.
Since they have the same type, we can check if one is less than the other, which allows us to write a loop:

```cpp

// Has to be outide of offset: can't take address of a local
// Has to be static: this is not a constant expression
static constexpr U u = {};

static constexpr const TMEMBER* addr_helper(const TMEMBER* base,
                                              const TMEMBER* target) {
  auto addr = base;
  while (addr < target) {
    addr++;
  }
  return addr;
}

static constexpr std::ptrdiff_t offset(TMEMBER TDUMMY::*member) {
  constexpr const auto addr_base = std::addressof(u.member);
  // only const: .*member is not a constant expression
  const auto addr_member = std::addressof(u.object.*member);
  const auto addr_diff = addr_member - addr_base;
  return addr_diff*sizeof(M);
}
```

Except that we get how many times we can fit the type between them, not the actual offset.
This works as long as:

* We don't use `#pragma pack` or anything similar to make the data member underaligned
* The size of the type is at most its alignment -- which is true for primitive types, but false for most structs or classes.

While the first could be an acceptable limitation, silently giving incorrect results for the second is quite dangerous.

Detecting the issue is easy enough:
if the number multiplied back with the difference isn't the same, we hit the bug.

```cpp
if(addr_found != addr_target) {
// error
}
```

To fix the issue, we have to modify the above union with a customizable padding, configured with an additional template parameter:

```cpp
union U {
  char c;
#pragma pack(push, 1)
  struct {
    char pad[N];
    TMEMBER m[sizeof(TSTRUCT) / sizeof(TMEMBER) + 1];
  };
#pragma pack(pop)
  TSTRUCT object;
  constexpr U() : c(0) {}  // make c the active member
};
```

`pragma pack` isn't standard C++ feature, but it's noly needed for supporting (non standard) packed structures.
For standard classes, it could be safety removed, and the size of the array could be `N*alignof(TMEMBER)`.

And after this, recursion solves the issue:

```cpp
if (addr_found > addr_target) {
  if constexpr (N < sizeof(TMEMBER)) {
    return offset_of_impl<TSTRUCT, TMEMBER, TDUMMY, N + 1>::offset(member);
  } else {
    throw 1;
  }
}
return (addr_found - addr_base) * sizeof(TMEMBER) + N;
```

This condition tries matching alignment up to the size of the object, and throws an error (forces a compilation error) if it can't find the correct offset.
Other than a sanity check, this condition is also the stopmark for the compiler:
this is a greedy recursion, which will generate `sizeof(TMEMBER)` helper classes for each type it is used with.
While the optimizer will take care of these symbols, it would not be ideal for a real world code, as it adds overhead - for a demonstration, it is good enough.

## Multiple inheritance

While testing this implementation, I encountered an unintuitive property of pointer to data members:
they do not work the way one would expect them with multiple inheritance.

With the same example as in the beginning:

```cpp
struct foo1{
    int i;
};

struct foo2{
    int i;
};

struct bar : public foo1, public foo2 {};
```

A member pointer `bar::foo1::i` will have the type `int foo1::*`.

Which means, that the following wrapper wouldn't work correctly:

```cpp
template <typename TSTRUCT, typename TMEMBER>
inline constexpr std::ptrdiff_t offset_of(TMEMBER TSTRUCT::*member) {
  return offset_of_impl<TSTRUCT, TMEMBER>::offset(member);
}

static_assert(offset_of(bar::foo2::&i) == 8); // fails!
```

There is no workaround other than specifying `bar` directly in a different parameter, which changes the syntax to `offset_of<bar>(bar::foo2::&1)`.
And this syntax has to be enforced for all use, otherwise use of the function would be error prone.

## The code

The full example is on [github][github].

[PTDM]: https://en.cppreference.com/w/cpp/language/pointer#Pointers_to_data_membersi
[gist]: https://gist.github.com/graphitemaster/494f21190bb2c63c5516
[soarith]: https://stackoverflow.com/a/43419534/
[github]: https://github.com/dutow/cpp-tests/blob/master/offset_of_1.cxx
[godbolt]: https://godbolt.org/z/Wdt-Vh
