### Rethinking PostgreSQL configuration

<hr>
<p>Zsolt Parragi · <a href="mailto:zsolt.parragi@percona.com">zsolt.parragi@percona.com</a></p>
<p style="font-size: 0.7em;">PGConf.EU · April 22nd, 2026 · Valencia, Spain</p>

<img src="img/qr-code.png" class="r-stretch">

---
## Who am I?

* **Zsolt Parragi** · Software Engineer at Percona
  * Joined Percona as a software developer in 2017 and has been working on Percona’s database products ever since 
  * Initially focusing on MySQL and later switching to PostgreSQL
  * https://hackorum.dev

--
## This is not a committed feature

* It's not in PG 19
* Most likely won't be in PG 20
* Not even a complete patch
* It's an idea with a working prototype
* And a discussion thread with alternative mockups

--
## Agenda

* About our configuration files
* A history, mostly how pg_hba evolved
* Ideas how we could make it better
* This is a discussion starter, give us feedback!

> How do you want your postgres configuration files to look like?

--
## Why?

* Config files are an important part of the UI
* We want to make it better
* We need feedback from you
   * DBAs
   * Users
   * Developers
   * ...

--
## Try it out!

* https://hackorum.dev/topics/253013
* https://postgr.es/m/CAN4CZFNXdKL4eb_GwT_h-vUuUV%2BCbPCk_8-%2BS3kV8iFmNmUw7A%40mail.gmail.com

```
docker run --rm -p 5432:5432 -e POSTGRES_INITDB_ARGS="--config-format=json" \
    ghcr.io/hackorum-dev/postgres-patch:t253013
```

---
## Who used a 80x24 terminal?

<img src="img/8024.jpg">

--
## PostgreSQL is 30

* Postgres/Postquel is 40
* pg_hba is there in the first Postgres95 1.01 commit
   * No .conf suffix
   * 3 columns

```plaintext
based on the securelib package originally written by William
LeFebvre, EECS Department, Northwestern University
(phil@eecs.nwu.edu) - orginal configuration file code handling
by Sam Horrocks (sam@ics.uci.edu)

modified and adapted for use with Postgres95 by Paul Fisher
(pnfisher@unity.ncsu.edu)
```

```plaintext
# <name>        <address>       <mask>
all             127.0.0.1       0.0.0.0
```

--

## What is securelib?

> SecureLib is most commonly known as a Minecraft security mod and library created by RubiiW to help players protect their bases and manage equipment ...

--

## What is securelib?

* Early Unix network access control library
* From 1993:

```plaintext
From: phil@pex.eecs.nwu.edu (William LeFebvre)
You may want to add a mention of securelib, a security enhancer
available for SunOS version 4.1 and higher.
```

--
## Current-ish version

* 1996-10-12
* Bryan Henderson
* *New host-based authentication*
* pg_hba.conf and pg_ident.conf

```
# TYPE       DATABASE    IP_ADDRESS    MASK              USERAUTH  MAP
host         all         127.0.0.1     255.255.255.255   trust
host         template1   192.168.0.0   255.255.255.0     ident     sameuser
```

--
## Is this readable?

```
# TYPE    DATABASE        USER           ADDRESS          METHOD   OPTIONS
include_dir   conf.d/hba
local     all             postgres                        peer     map=admins
host      all             @banned.txt    0.0.0.0/0        reject
hostnossl all             all            0.0.0.0/0        reject
hostssl   @prod_dbs.txt   @dba_list.txt  10.0.0.0/8       scram-sha-256
hostssl   "/^tenant_\d+$" +app_users     10.0.0.0/8       scram-sha-256
hostssl   all             all            .k8s.local       cert     clientname=DN map=certs
hostssl   intranet        +staff         10.60.0.0/16     ldap \
      ldapscheme=ldaps ldapserver=ad.corp.example.com \
      ldapbasedn="dc=corp,dc=example,dc=com" \
      ldapsearchfilter="(sAMAccountName=$username)"
hostssl   all             +sso_users     ::/0             oauth \
      issuer="https://login.example.com" scope="openid pg:connect"
host      all             all            all              reject
```

--
## What happened?

* *One more feature*
   * groups, SSL, CIDR, IPv6, regular expressions, lists
   * options for complex methods, such as ldap
   * line continuations
   * includes, both file-level and cell-level
   * with PG19 OAuth validators can add their own options

--
## What happened?

* We got used to it

> It could be better, but it works

> We just generate it with scripts

--
## include_dir in hba?

* How does that work with the ordering?
* all files ending in .conf will be read in file name order
* file name order is that defined by the C locale
* What about the ordering of `ls` / `dir`?
   * ls depends on case insensitive locale
   * dir returns filesystem order

--
## include_dir in hba?

```
# pg_hba.conf
include_dir   conf.d/hba
```

```
$ LC_ALL=hu_HU.UTF-8 ls conf.d/hba
admins.conf  App.conf  arvizturo.conf  árvíztűrő.conf  reject.conf

# C locale order, what postgres actually uses
App.conf  admins.conf  arvizturo.conf  reject.conf  árvíztűrő.conf
```

--
## What is @dba_list.txt?

```
# TYPE    DATABASE        USER           ADDRESS          METHOD
hostssl   @prod_dbs.txt   @dba_list.txt  10.0.0.0/8       scram-sha-256
```

```
# conf.d/hba/dba_list.txt
alice
bob
carol, dave        # commas and whitespace both work
+dba_group         # group names too
@junior_dbas.txt   # and it nests
```

```
# TYPE    DATABASE        USER           ADDRESS          METHOD
hostssl   @prod_dbs.txt   alice          10.0.0.0/8       scram-sha-256
hostssl   @prod_dbs.txt   bob            10.0.0.0/8       scram-sha-256
hostssl   @prod_dbs.txt   carol          10.0.0.0/8       scram-sha-256
hostssl   @prod_dbs.txt   dave           10.0.0.0/8       scram-sha-256
hostssl   @prod_dbs.txt   +dba_group     10.0.0.0/8       scram-sha-256
...
```

--
## Or @ldap_opts.txt

```
hostssl   intranet   +staff   10.60.0.0/16   ldap   @ldap_opts.txt
```

```
# conf.d/hba/ldap_opts.txt
ldapscheme=ldaps
ldapserver=ad.corp.example.com
ldapbasedn="dc=corp,dc=example,dc=com"
ldapsearchfilter="(sAMAccountName=$username)"
```

```
hostssl   intranet   +staff   10.60.0.0/16   ldap   ldapscheme=ldaps \
                              ldapserver=ad.corp.example.com \
                              ldapbasedn="dc=corp,dc=example,dc=com" \
                              ldapsearchfilter="(sAMAccountName=$username)"
```

--
## PG19: OAuth validator options

* Postgres 18 added support for OAuth
* Part of it is left for 3rd party validators
* Core parameters: issuer, scopes
* What if a validator needs something else too?

--
## Handling extra options

* PG18: only as global parameters in postgresql.conf
* postgres-keycloak-oauth-validator has 8 options

```
kc.token_endpoint = 'https://sso.example.com/realms/prod/.../token'
kc.audience       = 'postgres'
kc.resource_name  = 'db#connect'
kc.client_id      = 'postgres-uma'
kc.http_timeout_ms = 2000
kc.expected_issuer = 'https://sso.example.com/realms/prod'
kc.debug          = off
kc.log_body       = off
```
```
hostssl  all  +sso_users  ::/0  oauth \
      issuer="https://sso.example.com/realms/prod" \
      scope="openid pg:connect"
```

--
## Handling extra options

* PG19: we can now add it to pg_hba
* postgres-keycloak-oauth-validator has 8 options

```
hostssl  all  +sso_users  ::/0  oauth \
      issuer="https://sso.example.com/realms/prod" \
      scope="openid pg:connect" \
      validator.token_endpoint="https://sso.example.com/realms/prod/.../token" \
      validator.audience=postgres \
      validator.resource_name="db#connect" \
      validator.client_id=postgres-uma \
      validator.http_timeout_ms=2000 \
      validator.expected_issuer="https://sso.example.com/realms/prod" \
      validator.debug=off \
      validator.log_body=off
```

---
## PG19: pg_hosts

* Uses a similar structure to hba/ident
* Except: ordering doesn't matter
* How would you specify a passphrase without a CA?

```
# HOSTNAME            CERT         KEY         [CA]       [PASSPHRASE_CMD]  [RELOAD]
db.example.com        prod.crt     prod.key    root.crt
bi.example.com, analytics.example.com   bi.crt      bi.key
/no_sni/              legacy.crt   legacy.key
*                     default.crt  default.key root.crt   "pass-from-vault"  on
```

--
## Let's add alternative certs!

* Feature request / patch in 2026 June
* Serving multiple certificates for different key types
* How could we add it to pg_hosts?
* There's no way to do this cleanly in the current format

---
## Past changes

<!-- .slide: class="compact" -->

* 199X: original format
* **1996-10: host dbname ip mask userauth [map]**
* *2000-05: host dbname ip mask authtype [map]*
* 2002-04: host **user** dbname ip mask auth_type **[auth_arg]**
* *2002-09: host user dbname ip mask method [option]*
* 2003-06: host user dbname **ip/mask** method [option]
* 2008-10: host user dbname ip/mask method **[options]**

--
## Let's start from 0!

* We no longer use CRT terminals
* The format is no longer a simple tabbed file
* We made breaking changes 4 times already
* This time: dream big, break it completely!<sup>*</sup>

<p class="footnote"><sup>*</sup> With backward compatibility for a few versions</p>

--
## What do you want to configure?

```plaintext
On Thu, 09 Jul 2026, Jacob Champion wrote:

> Everyone has to use LDAP auth
> With this server
> And these TLS settings
> 
> Except admins
> who additionally need client certificates
> with this CA root
> 
> And Jacob
> who isn't allowed in anymore
```

--
## Today

```
# TYPE     DATABASE  USER     ADDRESS    METHOD  OPTIONS
# Jacob: gone (first match wins, so this goes first)
local      all       jacob               reject
host       all       jacob    all        reject
# LDAP sends the password in cleartext over the wire: refuse non-TLS
hostnossl  all       all      all        reject
# Admins: LDAP *and* a valid client cert (Can't set CA here!)
hostssl    all       +admins  all        ldap    clientcert=verify-full \
        ldapscheme=ldaps ldapserver=ldap.corp.example.com ldapport=636 \
        ldapbasedn="ou=people,dc=corp,dc=example,dc=com" ldapsearchattribute=uid
# Everyone else: LDAP only
hostssl    all       all      all        ldap \
        ldapscheme=ldaps ldapserver=ldap.corp.example.com ldapport=636 \
        ldapbasedn="ou=people,dc=corp,dc=example,dc=com" ldapsearchattribute=uid
```

--
## Current proposal
```
{ hba: { // SSL/TLS should be default
      children: [
      { // Everyone: LDAP auth over StartTLS
        auth: {
          method: 'ldap',
          ldapserver: 'ldap.example.com',
        }, children: [
          { // Admins: inherit LDAP, also need a client cert
            users: '+admins',
            auth: { clientcert: 'verify-full' },
            settings: { ssl_ca_file: 'admins.crt' }
          },
          // Jacob: no longer allowed
          { users: 'jacob', auth: { method: 'reject' } }
]}]}}
```

--
## JSON is everywhere

* JSON5 => JSON transformation is trivial
* Editors, queries, in-database storage
* Json schema
* Syntax highlighting

```plaintext
On Tue, 07 Jul 2026, Tristan Partin wrote:

> I do not like it. I have created some VSCode extensions to help with
> syntax highlighting, but I would enjoy deprecating those.
```

--
## Take it as an inspiration

* The example is only a discussion starter
* We want to hear about ideas from you
* If you want to keep HBA, that's also an answer

---
## Dream big!

* What if we could change anything?
* Do we need the current separation?
* postgresql.conf / hba / ident / hosts

--
## Unify everything

* postgresql.json
* "hba", "hosts", "idents" are objects
* Or can be imported
* Anything can be imported

--
## One file to rule them all

```
{
  shared_buffers: '2GB',
  max_wal_size: '16GB',

  hosts: {
    '*': { ca: 'foo.ca', cert: 'foo.crt', key: 'foo.key' },
    'other.host': { cert: 'foo2.crt', key: 'foo2.key' },
  },
  hba: {
    children: [
      { auth: { method: 'trust', address: '127.0.0.1/32' },
      { auth: { method: 'scram-sha-256' },
    ]
  }
}
```

--
## Example: multitenant

```
{
  shared_buffers: '2GB',
  max_wal_size: '16GB',

  import: "tenants/*.json"
}
```
```
// tenants/X.json
{ 
  hosts: {
    'tenant.tld': { ca: 'tenantX.ca', cert: 'tenantX.crt', key: 'tenantX.key' 
      settings: {
        log_filename: 'where/to/log/this/tenant.log'
      }
    },
  },
  hba: {
    children: [
      { auth: { db: 'tenantX', method: 'oauth', ... },
    ]
  }
}
```

--
## import *.json

* We can only import at the top level
* Multiple files define the same object: merge
* Multiple files define the same value: error

--
## arrays

* Do we need them?
* pg_hba is the only user 
* (db,user,host,method) is unique key
* specific wins over *
* subnets: most specific wins

---

## Do we even want JSON(5)?

* Convinient: postgres already knows JSON
* We can teach the parser JSONC/JSON5
* Who prefers TOML? YAML? XML?
* Something else?

--

## pg_hba_file_rules?

* Most of it should work as-is
* End result has to be the same
* We might need an offset too, line_number is no longer enough

--

## Related ideas?

* Signed configuration files?
* Sourcing config files directly from HTTP(S)?

--- 
## Questions?

### Find me after the talk or online:

**zsolt.parragi@percona.com**

*Slides: [https://dutow.github.io/slides/pgconf-eu-2026-config/](https://dutow.github.io/slides/pgconf-eu-2026-config/)*

<img src="img/qr-code.png" class="r-stretch">