---
layout: post
title:  "Better static assert for numeric tests"
date:   2020-03-05 15:54:50 +0100
excerpt_separator: <!--more-->
---

Using `consteval` instead of `constexpr` kind of solved my previous issue, but it didn't make the original issue go away:
`static_assert` is far from user friendly for numeric assertions - but we can actually make it a littleb better.

The code I showcase here is also available as `assert.hpp` in [tsar][tsar].

<!--more-->

## The goal

The issue we have is that a simple assertion like `static_assert(4==5)` will only tell us that the test failed, without telling us the actual values.
While this looks oblivius, In a more real world example, this would be something like `static_assert(complex_function<foo,bar>(a,b)==42)`.
And with the assertion failing, we probably have a quite important question: okay, it's not 42, but then what is its value?

Compared to static assertions, modern runtime testing frameworks like [Catch2][catch2] display the expression with the actual values filled in, but keeping the original form.
If the failing expression is `(a+b)/3==4` fails, Catch would tell us that the issue is with the `(4+9)/3==4` expression, making our job figuring out the reason behind it much easier.

## How catch2 works?

The foundation of this expression display is the `REQUIRE` macro in catch:
we would describe the above expression as

```cpp
REQUIRE((a+b)/3==4)
```

Then this macro is expanded, and our expression transforms to 

```cpp
some_catch_helper_type{} && ((a+b)/3==4)
```

That type has some custom overloaded operators, allowing to Catch2 to construct a syntax tree of our expression -- or rather, the compiler is friendly enough to construct the syntax tree for it.
With that syntax tree built, displaying each value is quite simple.

## The catch

While it would be great to implement a `STATIC_REQUIRE` macro similar to the above, we have an issue:
while the syntax tree is constructed by the compiler in compile time for the above example, the actual values are evaluated in runtime.
For a static version of the macro to work we would need the values to be available during compile time.

This problem is partially solved, with user literals many libraries (e.g. hana) allow developers to specify numbers as types.
Partially, however, doesn't mean completely:
first, we would have to modify manually specified numbers to number literals.
For example, we would have to change `3` to `3_t`.

Then we would face the problem of computed values:
We can't say `a_t`, that doesn't work, even if `a` is a constexpr variable.

I can't think of anything in C++20 allowing is to automatically convert a constexpr number into a type.

## A different approach

With this limitation, we can't improve on our assertion without actually changing how we describe our assertion.
But can we do something by actually changing the expression?

Instead of trying to come up with something user friendly and completely generic, first I looked at the static assertions in the C++ code I usually work with.
99% of the assertions are either boolean expressions (`a && b || c ...`) or simple numeric check in the form of `a + b - c ... = d + e ...`.
Usually simple expressions even in these categories.

As boolean expressions are rather easy to deal with on the spot code modification tests, I put those aside for now, and focused on the additive equality checks.

Older unit testing frameworks did not have fancy APIs like this REQUIRE macro.
Instead they had custom assertion functions like `assertEquals(a,b)` or `assertGreater(a,b)`.
That's an approach we could follow here too, as compilers usually give us nice resolved type names:

```cpp

template <long long A, long long B>
consteval bool equals(){
static_assert(A==B);
return A == B;
}

static_assert(equals<a,b>())
```

Note that we used two static asserts (and we will get two assertions from the compiler).

The outer assertion ensures that we get our error message at the same place as before, which likely gives us some more context about the issue.
But it still can't give us any information about the values themselves.

The assertion inside `equals` is at a different place, but it is inside a template function parameterized with our values.
The most widely used compilers will display us the name of the function, giving us the values we require to understand the problem:

> <source>: In instantiation of 'consteval bool equals() [with long long int A = 5; long long int B = 4]':

### Handling sums

The above example works with earlier standards, and already covers at least 80% of my numeric tests - but can we make it better?

It looks trivial how we should add support for additive operations:

```cpp
static_assert(equals<sum<a,b>(),c>());
```

Unfortunately this wouldn't work as expected:
The compiler will only display the type parameters of `equals` - at this point `sum` is already resolved to a numeric value, and we would only see the result of the additions.

For this to work, we have to make the `sum` expression part of the type.
With C++17 and before, we could try converting the `long long` template parameters to `typename` type parameters.
We would have to pass numeric values as types instead, which would result in the issue we already faced with the original idea:
Instead of `4` we would have to write `4_t`, and instead of `foo_returning_int()` something like `type_v<foo_returning_int()>`.

Not that bad, but since we are focusing on C++20, we can do a bit better with the `auto` keyword:

```cpp
template<auto... Args>
struct sum {
    consteval operator long long() const {
      return (... + Args);
    }
};

template <auto A, auto B>
struct equals{
    consteval operator bool() const {
        static_assert(A==B);
        return A==B;
    }
};

static_assert(equals<sum<2,-3>{},5());
```

I'm not saying it's too pretty, but it works, see a live example on [godbolt][godbolt].

Thanks to the `auto` keyword, `equals` now accepts any value type usable in templates.
This includes the previous `long long` values, but also includes any empty struct type.

Like the `sum` type above it, which doesn't have any data member:
its only notable feature is that it can be implicitly converted to a `long long`, and for that conversion, it uses the numbers given to it as template parameters.

With this, every value used in the computation is available as a direct or indirect template parameter to `equals`, which means the compiler will display it as a context information when the `static_assert` inside it fires.

## Further work

I'm quite sure that the above simple example can be improved: 
other operators are easy to implement, and probably the syntax could be improved too - maybe with the use of some macros?

[catch2]: https://github.com/catchorg/Catch2
[godbolt]: https://godbolt.org/z/Unjkmd
[tsar]: https://github.com/dutow/tsar
