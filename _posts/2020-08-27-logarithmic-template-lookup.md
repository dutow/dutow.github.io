---
layout: post
title:  "Logarithmic template lookup"
date:   2020-08-27 19:30:45 +0100
excerpt_separator: <!--more-->
---

Template metaprograms, like the [stateful linked list example][list] often end up with recursive structures.
While these are usually tail recursive, the C++ compiler can't convert them to loops.
This, combined with the by the depth limit of the template instantation call stack (900 by default) limits the capabilities of template structures and computations.

Using parameter packs instead of resursion can help:
by computing a few hundred entries in "parallel" instead of recursively, we can increase the input space.
For example, by doing 500 computations in each step, we can increase the theoritical limit to 500*900 instead of 900.
Of course, the compiler will most likely crash way before reaching that point -- or if it doesn't, it will run out of memory.
According to [Luise Dionne's measurements][ldionne-measure], this is also fastrr.

But it also has some downsides:
for example, the compiler will instantiate each referenced template, there is no way to short circuit it, which means the metaprogram will define way more symbols than it has to.
The instantiation order of a parameter pack is also undefined, the program can't expect the parameters to be resolved in index order.

With these issues, pack expansion isn't optimal for every calculation.
In this post, we explore a different approach:
logarithmic (binary) search.

<!--more-->

We'll assume that we have an indexed template:

```cpp
template<std::size_t IDX>
bool Pred()
```

`Pred<I+1>()` can only return `true`, if `Pred<I>()` was also `true` - which represents the ordering requirement of binary search.
Our goal is to find the last index where this predicate returns `true`.

As this search function could be useful for several templates (different predicates), we aim for a generic approach.
The easiest way to do this, from an user's perspective is to use generic lambdas -- Predicate classes that have templete call operators:

```cpp
class Pred {
  template<std::size_t IDX, typename Id>
  bool operator() const;
}
```

For simplicity, we still refer to this as the `Pred<I>()` function in this blog post, except in actual code.

Using a predicate like this, we aim to implement a simple search function:

```cpp
template<typename Pred, auto Id = [](){}>
std::size_t log_search_v(Pred const& p);
```

To handle `Pred<first>()==0` (empty lists), we have three choices:

 * Start indexing with 1. logarithmic_search could return 0
 * Start indexing with 0. Return the index of the first false item (0) instead of the last true item
 * Use -1 (`npos`) for the lack of records (and also a signed index type)

All of these have pros and cons.
For our actual usecase, mentioned in the previous blog posts, the second approach seems to be the best:
several questions we have to answer require the index after the last item.

### Finding the upper bound

Logarithmic search usually requires a current container size, and starts with halving it, to test if the condition holds for the middle item.
In our case, calculating the container size is also one of the recursive operations we need binary search for.

Fortunately we have a limit for the container size: 
it has to be between 0 and the maximum value of `std::size_t`.
While using the maximum of `std::size_t` as the size would work, recursive structures (lists) start at the beginning, and slowly build up from there, one by one.
Starting from the middle of a 64 bit range, this would reach the first part of the container in around 30 steps.

To reduce the expected steps, we can modify the search to first approximate the size starting from the beginning, similarly to binary search:
starting at 1, and going through the 2 powers, we can find the first unused 2 power in O(log(n)) steps.
Then we can use the last existing 2 power, and this value as our range for the classic binary search.

This will result in a worst case of 126 steps, which is still significantly below the recursion limit, and it is also highly unlikely at the end.

### Implementation

```cpp
template<typename P, typename Id>
consteval std::size_t log_search_v() {
  constexpr std::size_t pow_level_before = log_up_check<P, 0, Id>();
  if constexpr (pow_level_before == 0) {
    // 0 = 2**1 == 2 is false. P<0> and P<1> can still be true
    if constexpr (detail::do_lookup<P, 1, Id>()) {
      return 2;
    }
    if constexpr (detail::do_lookup<P, 0, Id>()) {
      return 1;
    }
    return 0;
  } else {
    return log_in_checkh<P,
                         pow2<pow_level_before>,
                         pow2<pow_level_before+1>,
                         pow_level_before>();
  }
}
```

We are using several helpers in this function.

`log_up_check` and `log_in_check` are the previously mentioned binary search parts:

 * `log_up_check` will return the last two power where the predicate is still true
 * `log_in_check` will run the logarithmic search in the last interval

`pow2` is a template variable containing the corresponding 2 power for up to 64 bits (length of `std::size_t`), with the exception of `2**64`:
`size_t` can't hold the last value, and the index also can't be it. We can use one less instead. 

```cpp
template<size_t I>
constexpr size_t pow2 = pow2<I-1> * 2;

template<>
constexpr size_t pow2<0> = 1;

// NOTE: don't hardcode in 64 in production
template<>
constexpr size_t pow2<64> = (pow2<63>-1)*2+1;

template size_t pow2<63>;
```

And `do_lookup` is a function that evaluates the Predicate at an index - a convinience function as we have to do it at many places:

```cpp
template <typename Pred, std::size_t Idx, typename Id>
consteval bool do_lookup() {
  Pred l{};
  return l.template operator()<Idx, Id>();
}
```

Apart from using the same SFINAE trick as in the previous template list post, there is nothing surprising in `log_up_check`:
it is the same as the linear lookup function, except that it uses the above `pow2` helper for converting the linear index to a 2 power:

```cpp
template <typename Pred, std::size_t Pow_level, typename Id>
consteval std::size_t log_up_check(float) {
  return Pow_level;
}

template <typename Pred, std::size_t Pow_level, typename Id,
          typename = std::enable_if_t<do_lookup<Pred, pow2<Pow_level + 1>, Id>()>>
consteval std::size_t log_up_check(int) {
  return log_up_check<Pred, pow2<Pow_level + 1>, Pow_level + 1, Id>(0);
}
```

`log_in_check` howewer, is more interesting:
binary search is usually implemented in an iterative manner with a loop.
That's not possible for us, since even `consteval` functions have to follow the usual C++ rules, apart from using `if constexpr` blocks, all symbols have to be immediately resolvable.
There is no `constexpr for`, we woundn't be able to use the loop variables as type parameters for `do_lookup`.

That leaves us with the recursive algorithm.
A modified recursive algorithm, since the classic binary search operates on a collection of numbers, while we have a series of `true` and then a series of `false` values.

```cpp
template <typename Pred, std::size_t Start_idx, std::size_t End_idx, typename Id>
consteval std::size_t log_in_check(float);

template <typename Pred, std::size_t Start_idx, std::size_t End_idx, typename Id,
          typename = std::enable_if_t<do_lookup<Pred, log_in_middle<Start_idx, End_idx>(), Id>()>>
consteval std::size_t log_in_check(int) {
  if constexpr (Start_idx + 1 == End_idx) {
    return Start_idx;
  } else {
    // the middle exists -> it should be larger
    return log_in_check<Pred, log_in_middle<Start_idx, End_idx>(), End_idx, Id>(0);
  }
}

template <typename Pred, std::size_t Start_idx, std::size_t End_idx, typename Id>
consteval std::size_t log_in_check(float) {
  if constexpr (Start_idx + 1 == End_idx) {
    return Start_idx;
  } else {
    // the middle doesn't exists -> it should be smaller
    return log_in_check<Pred, Start_idx, log_in_middle<Start_idx, End_idx>(), Id>(0);
  }
}
```

The above code implements the two recursive branches in the two SFINAE branches: if the `enable_if` condition in the first variant is true, the middle item in the range exists.
This means (unless we are at the end) that we have to go to the upper half.

Similarly, if we are in the other variant, then the condition failed, and we have to look in the lower half.

### That's all

As usual the above code is publicly available in the [tsar][tsar] repository with some tests.

[list]: {% post_url 2020-01-07-double-linked-templates %}
[ldionne-measure]: https://ldionne.com/2015/11/29/efficient-parameter-pack-indexing/ 
[tsar]: https://github.com/dutow/tsar
