### Modernizing Postgres Communication with Hackorum

<hr>
<p>Zsolt Parragi · <a href="mailto:zsolt.parragi@percona.com">zsolt.parragi@percona.com</a></p>
<p style="font-size: 0.7em;">PGConf.DE · April 22th, 2026 · Essen, Germany</p>

---

## Who am I?

* **Zsolt Parragi** · Software Engineer at Percona
  * Joined Percona as a software developer in 2017 and has been working on Percona’s database products ever since 
  * Initially focusing on MySQL and later switching to PostgreSQL
  * Likes to focus on things that make life easier and safer: encryption, authentication, extensibility, testing, and tooling.

---
### Agenda

* OIDC? Security? Convenience?
* PostgreSQL and (vaidator) plugins
* Minimal OIDC setup with PostgreSQL
* Questions?

--
### Sorry for the long explanation...

* But I hope it's not boring
* This is an easy to use feature*
* That is difficult to use correctly
* Avoiding the "Let's simplify it for the demo" mentality
  * Ignoring security concerns for a security feature


---
### From the PostgreSQL perspective
* New in PostgreSQL 18
* Improved in PostgreSQL 19
* More improvements expected in PostgreSQL 20+
* Requires server side support (plugins)
  * pg_oidc_validator
  * others?
* Requires client side support
  * Libraries
  * Applications
  * Libpq plugins


---
### OAuth or OIDC?
* OAuth
  * Grants "permissions" to apps without sharing passwords
  * "What can you do?"
  * Gives an access token
* OIDC
  * Introduces the concept of "identity" on top of OAuth
  * "Who are you?"
  * Gives an identity token


--
### Which is better for us?
OAuth

If a user can supply an OAuth access token with the "pg-admin" scope, assign the admin role to him

OIDC

If a user can log in with this provider, look up his role in pg_ident.conf based on his email address


--
### OIDC: for security!
* Centralized user control
* Risk reduction with short lived tokens
* Enforced security standards (password policy, MFA, ...)
* Open standard, no vendor lock-in

--
### OIDC: for convenience!
* SSO, "Login with Google/Okta/..."
* Click next, next, next, no need for passwords!
* Implicit trust
* Provider/workflow omissions

---

### Client types

* OAuth clients have an id and a secret (password)
* Confidental clients: can store secrets securely
* Public clients: everything is visible for everyone

--

### Authentication flows

* Authorization code flow for server-client applications
* Authorization code flow with PKCE for single page / desktop applications
* Client credentials flow for application-application communication
* Device Authorization Grant for limited devices (smart tvs, printers, psql...)

--

### PostgreSQL is a ...

* Confidental client
* A public client with web authentication
* A limited device public client
* None of the above

--

## PostgreSQL is a resource server

* It is not a client at all
* OAuth flow/authentication is up to the software using PostgreSQL
* Receives the access token after the OAuth flow completed

--

## The clients

* psql
* pgAdmin
* A Django/Rails/... traditional web application
* A desktop application using libpq
* ...

---

## Public and device clients

* The "password" is public
* Any other software can impersonate
* Users have to verify: am I logging in where I want to?
* Device flow is even worse
  * The "device" logging in, and the device authenticating it is different
  * Can be even on two different continents...

### The dangers of laziness

* Security requires explicit consent
* Don't skip consent screens
* Never use generic scopes
* Educate users

--

### Can we make it better?

* The "password" is public
* There are some possible improvements
  * PKCE
  * DPoP
  * ...
* These are improvements, not magic fixes
* Not supported by PostgreSQL 18
* Test and verify your providers!

---

### From the PostgreSQL perspective
* New in PostgreSQL 18
* Improved in PostgreSQL 19
* More improvements expected in PostgreSQL 20+
* **Requires server side support (plugins)**
  * pg_oidc_validator
  * others?
* **Requires client side support**
  * Libraries
  * Applications
  * Libpq plugins

--

### Requires server side support

* OAuth/OIDC is a collection of standards
* Leaves many details to implementations
* Some identity providers clearly deviate from the RFCs

* Simple example: access tokens
  * JWT for many providers
  * Opaque for some
  * Proprietary introspection APIs vs signature verification

-- 

### Minimal setup

pg_hba:

```
host    all             all             127.0.0.1/32            oauth   issuer=issuer_url scope=pgserver1 validator=pg_oidc_validator
```

postgresql.conf:

```
oauth_validator_libraries =pg_oidc_validator
```

Connecting:

```
psql -h 127.0.0.1 'dbname=postgres oauth_issuer=issuer_url oauth_client_id=pgclient'
```

-- 

### Multiple providers?

pg_hba:

```
host    all             all             127.0.0.1/32            oauth   issuer=issuer1_url scope=pgserver1 validator=pg_oidc_validator
host    all             all             127.0.0.1/32            oauth   issuer=issuer2_url scope=pgserver1 validator=pg_oidc_validator
```

postgresql.conf:

```
oauth_validator_libraries =pg_oidc_validator
```

Connecting:

```
psql -h 127.0.0.1 'dbname=postgres oauth_issuer=issuer2_url oauth_client_id=pgclient'
```

---

### Demo

* Docker environment available at:
  https://github.com/percona/pg_oidc_validator/examples/keycloak

* OIDC blog posts at
  https://percona.community/tags/oidc/

--- 

# Questions?

### Find me after the talk or online:

**kai.wagner@percona.com** · [github.com/hackorum-dev/hackorum](https://github.com/hackorum-dev/hackorum)

*Slides: [https://imthekai.github.io/pgmeetup-berlin-march-2026/](https://imthekai.github.io/pgmeetup-berlin-march-2026/)*

---
<img src="img/pgconf_de_2026_final.png" width="40%" height="40%" style="background:none; border:none; box-shadow:none;"><br> April 21-22 in Essen, Germany

