---
layout: post
title:  "Template state machine: automated lists"
date:   2020-01-07 20:09:45 +0100
categories: fancy-dsl
---

Metaprogramming in C++ aims to be state free.
For a long time, I thought that while there were exceptions to this, those were all too complicated for real world use, or was made possible by compiler extensions/bugs.
Tuns out that I was wrong, and we had the ability to write stateful metaprograms since C++11 - and this allows us to create some user friendly DSLs.

## Use case?

Staying with the topic of my [previous post]({% post_url 2020-01-05-forward-declared-inheritance %}) and struct-like DSLs, given a struct definition like this:

{% highlight cpp %}
struct foo_struct {
  field(T1, a);
  field(T2, b);
  field(T3, b);
};
{% endhighlight %}

I want to be able to iterate over the fields.

* Reflection is definitely in the far future for C++, which nudged me into other directions.
* Another possibility was using [hana-style][hana] named tuples, but that resulted in an ackward syntax, and also required defininig structures within function bodies - something I wanted to avoid in production code.
* One more alternative was to make it a single listed list:
every item could reference the previous, allowing for backward iteration.
Unfortunately this required access to the always changing tail (hard to keep track), and the user had to specify the links manually - again making it unsuitable for real world applications.

## The source of the idea

I always wondered if the `__COUNTER__` macro could be implemented in (relatively simple) standard C++, and tried to follow related projects.
The first proof of concept I've seen was [Filip Roseen's work][filiproseen] in 2015, and then [Bastien Penawayre's C++20 unconstexpr][unconstexpr] last month.

This latter seemed to be better suited for actually using in production code:
the presented `auto decltype` pattern (shown later in this post) only requires a few lines of code, and it could be used for much more than what's described in that readme.

However, I was afraid that it wasn't strandard compliant, and that it could be fixed by a new compiler release in the future...
I did some (standard) reading, and to my understanding, it's how it should work, but who knows.

That's how I stumbled upon [N3386], which mentions that the same idiom is possible since C++11, using `sizeof` instead of `decltype`, while arguing for allowing forward declaring `auto` functions:

{% highlight cpp %}
// gcc -std=c++11
template<typename T2, size_t = sizeof(T2)>
constexpr int f(int) { return 1; }

template<typename T2>
constexpr int f(float) { return 2; }

struct M1{};
struct M2{};
struct S;

constexpr auto a = f<S>(0); // 2
static_assert(a == 2, "SFINAE failure");

struct S{};

// Both functions are available now, 
// first it choosen using overload resolution
constexpr auto b = f<S>(0); // 1
static_assert(b == 1, "SFINAE success");
{% endhighlight %}

As this is here for 9 years now, I don't see why it would be removed later.

## Hijacking ADL

The above sizeof example is unfortunately limited:
while it allows for changing the state during compilation, the type required for the check cannot be declared in any scope for the SFINAE expression to work.
This makes the (C++17) auto constexpr method superior, as it allows a state change anywhere, by simply instantiating a template, as shown by the `unconstexpr` library.

It also allows something even more powerful:
forward linking!

{% highlight cpp %}
struct list_item_1 {
  friend auto next_link(list_item_1*);
};

struct list_item_2 {
  friend auto next_link(list_item_1*) {
    return static_cast<list_item_2*>(nullptr);
  }
  friend auto next_link(list_item_2*);
};

static_assert(std::is_same_v<next_link(static_cast<list_item_1*>(nullptr),
                             list_item_2*>());
{% endhighlight %}

* By declaring a friend taking a `list_item_1` parameter withi `list_item_1`, we ask the compiler to consider this overload using ADL.
* By declaring it using `auto`, and providing the type later in `list_item_2`, we inject a new type into the ADL scope of `list_item_1`.

Note how we need both for this to work:
 * Without forward declaring it in `list_item_1`, the compiler wouldn't be able to find the definition written in `list_item_2`, as that's not included in the parameter list.
 * Without the `auto` keyword, we wouldn'm be ablo to return `list_item_2*`, as it isn't even forward declared at the point of the declaration.

## Compiler warnings

GCC thinks that forward declaring a non template friend makes no sense, and generates a warning.
This is true most of the time, but also presents an issue for us, as we need that forward declaration.
The solution is simple enough:
The `next_link` functions should be templates.

{% highlight cpp %}
  template<typename Id>
  friend constexpr auto next_link(list_item_1*, Id) noexcept {
    return static_cast<list_item_2*>(nullptr);
  }

  template<typename Id>
  friend constexpr auto next_link(list_item_2*, Id) noexcept;
{% endhighlight %}

C++20 also would allow `template<auto Id = [](){}>`, but that currently only works in GCC, and even there, defaulting it isn't reliable.

## Automating the back reference

While the above code added forward links to our code, part of the original issue remains:
we still have to specify the previous type in `list_item_2`.

Fixing that is easy:
Since we have our items forward linked (up to where `next(foo) == list_item_1*`), given a known starting point, we should be able to iterate to the previous end (`list_item_1`), using the auto SFINAE trick by `unconstexpr`.

In the use case showcased at the start, this starting point could be injected comfortably in multiple places:

* Given a start macro like in my previous blogpost, `foo_struct` could inherit it from a parent defined by the start macro
* Even without a start macro, we could make all `field` macros start by `struct list_id; ...`, as we can declare a struct as many times as we want to, and a declaration should be enough.

To go with the second approach (only requiring a declaration), we can also define a simple template for the list head:

{% highlight cpp %}
template<typename T>
struct list_head {
    template<typename Id>
    friend constexpr auto next_link(list_head*, Id) noexcept;
};
{% endhighlight %}

This way the list head acts just like a list item, making implementing the last item quite simple:

{% highlight cpp %}
template<typename T, typename Id>
constexpr T list_last_or_this(float, T, Id);

template<typename T, typename Id,
         typename R = decltype(next_link(static_cast<T>(nullptr), Id{}))>
constexpr auto list_last_or_this(int, T, Id)
-> decltype(list_last_or_this(0, R{}, Id{})) {
  return nullptr; }

template<typename L, typename Id>
constexpr
decltype(list_last_or_this(0, static_cast<list_head<L>*>(nullptr), Id{}))
list_last(L, Id) { return nullptr; }
{% endhighlight %}

The only tricky part is the `decltype(next_link)` in the second function, and that expression is why we can implement this:
just like in the first `sizeof` example, this decltype results in a SFINAE substitution failure if `next_link` is declared, but not defined.

A complete example is available on [godbolt][godbolt], including a helper template to make something a list item.

## Usability

As with the previous works I linked, the code shown in this blog post, in its current form is only a proof of concept.
A real library would need more utility functions and some error handling, and most importantly:
refactoring to remove some of the size limitations.

Currently usage is limited by `list_last_or_this`, as its `decltype` expression causes recursive template instantaitons.
GCC has a default recursion limit of 900, making that the maximum length we can handle.
This also results in a performance issue, as the number of generated symbols is exponential based on the list length:
a list with 900 members compiles around 40 seconds on my PC.

Solving this with refactoring how `list_last_or_this` and similar helpers work will be the topic of a future post.

[hana]: https://www.boost.org/doc/libs/1_61_0/libs/hana/doc/html/index.html
[filiproseen]: http://b.atch.se/posts/non-constant-constant-expressions/
[unconstexpr]: https://github.com/DaemonSnake/unconstexpr-cpp20
[N3386]: http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2012/n3386.html
[godbolt]: https://godbolt.org/z/_qd4yc
