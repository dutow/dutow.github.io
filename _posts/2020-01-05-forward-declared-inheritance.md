---
layout: post
title:  "Inheriting from forward declared types"
date:   2020-01-05 17:02:06 +0100
categories: fancy-dsl
---

C++ (and usually, pragramming languages) doesn't allow inheriting from incomplete types.
And there is a good reason behind this: 
the inherited type has to know many properties of the parent type, which information isn't available in this case.
While this makes sense, there are a few corner cases when this "feature" could be useful - and a similar result can be achieved, with some workarounds.

{% highlight cpp %}
struct incomplete;
struct foo : public incomplete { // compilation error
};
{% endhighlight %}

## Why?

A real world use case is when implementing some libraries/DSLs:
all it needs is a library based on user types, and some of the logic depending on the complete type.

{% highlight cpp %}
#define dsl_sype(name) struct name: public dsl_base<name>
// ...
dsl_type(foo) { 
 // ...
};
{% endhighlight %}

A syntax like above works as long as dsl_base only accesses the properties of `name` inside it's methods, where its definition is already visible.
Which doesn't allow for use cases where the contents of `dsl_base` changes based on what's inside `name`.

A simple workaround is adding an additional using declaration at the end:


{% highlight cpp %}
template<typename T>
struct dsl_wrap: public T { /* ... */ };
// ...
#define dsl_sype(name) struct name##_base: public dsl_base<name>
#define dsl_end(name) using name = dsl_wrap<name##_base>;
// ...
dsl_type(foo) { 
 // ...
};
dsl_end(foo);
{% endhighlight %}

Unfortunately this requires additional changes from the user, it's no longer a single struct-like macro.

## How?

The issue can be solved by moving the using declaration before the type itself, as that could be hidden behind a single macro:

{% highlight cpp %}
template<typename T>
struct dsl_wrap: public T { 
  char data[sizeof(T)];  // or anything
};
// ...
#define dsl_sype(name)                      \
  struct name##_base;                       \
  using name = dsl_wrap<name##_base>;       \
  struct name##_base: public dsl_base<name>
// ...
dsl_type(foo) { 
 // ...
};
{% endhighlight %}

This might seem strange after the first example showing the error, but this works, even if `dsl_wrap` depends on knowledge about `name`, such as in the example above.

The trick here is that the using declaration above doesn't actually instantiate the type, it only declares it.
Implicit template instatiation happens the first time the code refers to the template in a context that requires a defined type - and the using declaration isn't one.
The `dsl_wrap<foo>` type will instantiated the first time the code needs the complete definition of it (such as when used as a value type), at which point it is already defined.

Which means that the code doesn't violate the original rule - the inheritance is resolved after the parent type is already completed.
The issue is only that because the order of lines suggest differently, this could be unintuitive at first.
