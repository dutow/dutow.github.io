---
layout: post
title:  "The fantastic consteval"
date:   2020-02-12 19:55:50 +0100
excerpt_separator: <!--more-->
---

The new `consteval` keyword in C++20 seemed like a nice, but not that important addition at first.
The idea behind it is simple:
with `constexpr`, the compiler may or may not compute the result at compile time, and with `consteval`, compile time evaluation is required.

This makes it only useful for (debug build) optimizations, right?
Wrong!

Speeding up debug builds, where otherwise we could end up with long tail-recursive helpers evaluated at every use is definitely a nice bonus, but `consteval`
can also change the result of our program!

<!--more-->

## The impossible bug

In the previous posts, I showcased some programs where we forced the compiler to "reevaluate" `constexpr` functions.
This technically wasn't reevaluation: we provided different dummy parameters for templated `constexpr` functions, and with this, the compiler actually generated new functions for each invocation.

While improving my `constexpr` list example, I made some mistakes.
As there are no good template debuggers for gcc-trunk, which is the only compiler currently supporting the featues I'm using, I had to rely on old school debugging:
`static_assert` and `std::cout`.

The latter seemed especially useful, as while `static_assert` is nice, it doesn't display the actual values used in the evaluation, only the optional message specified by the developer.
For example when I added an assertion that the size of the list should be 5, it only told me that it's a different number.
And it would have been really useful to know how away it is:
I suspected an off by one error, but who knows?

Instead of testing 4 and 6 with assertions, I decided to modify the line to print out the result, tweak the code until it works, and then replace the assert.
The program compiled, and printed out 17, which was the size of the whole list, including the elements I've added below that line.

Something was terribly wrong with my size function, and I ended up debugging this issue for the next hours, without any change in the output.
No matter what I did, the program dutifully displayed how many items I added in the entire source code.

Realization hit me after teaking a short break: 
`constexpr` doesn't give us any guarantee that it will be evaluated at that point, only that it can be.

The following simple code actually can display two different numbers:

```cpp

template<typename T, typename DUMMY>
constexpr bool foo(T t, DUMMY) { 
  // result doesn't depend on the value of DUMMY, but depends on the defined state of T
}

// ...

std::cout << foo(T, [](){}) << std::endl;
constexpr bool b = foo(T, [](){});
std::cout << b << std::endl;
```

[Here's][godbolt] a full working example on godbolt.

## The solution

This happened in January, and the solution at that time was to force constexpr evaluation manually using a wrapper template.
Instead of writing `foo(...)`, I've changed my code to use `constexpr_wrap<foo(...)>` everywhere.

Since then, it's February, and GCC learned about `consteval`.
The fix is easy now:
all hail `consteval`!

Looks like in the future, the role of `constexpr` will be mostly a fallback for backwards compatibility in template metaprogramming.


[godbolt]: https://godbolt.org/z/Ge5Bax
