# Property Listings API

An API for a property marketplace. You can add listings for rent, sale and
shortlet, and you can search them.

The main thing it does is answer a question like "show me 2 bedroom flats to
rent within 5 km of Lekki, under 3 million a year", and answer it fast even
when there are a lot of listings.

Built with NestJS, PostgreSQL and PostGIS. The full API documentation is at
`/docs` once it is running.

## What you need

Docker and Node 20 or newer.

## How to run it

```bash
pnpm install
cp .env.example .env
docker compose up -d          # starts the database
pnpm migration:run            # creates the table and the indexes
pnpm seed                     # adds 2 agents and 6 real Lagos listings
pnpm start:dev
```

Now open http://localhost:3000/docs. You can try every endpoint from that page.

The 6 sample listings always get the same IDs, so the examples in the docs
actually work. If they changed every time you re-seeded, every example would
give you "not found".

Here is a search that returns something. Rentals within 20 km of Victoria
Island, closest first:

```bash
curl "http://localhost:3000/listings?latitude=6.4281&longitude=3.4219&radiusKm=20&type=rent"
```

The sample listings are spread from Yaba to Ajah, so try different distances.
At 5 km the only thing near Victoria Island is the shortlet.

## Running the tests

```bash
pnpm db:test:create   # run this once
pnpm test             # 18 tests, no database needed
pnpm test:e2e         # 28 tests against a real database
```

The second set of tests empties the table between each test. So they run on a
separate database, not the one you are using.

This is not just a rule I wrote down. The app checks it in code: when it is
running tests it uses the test database and it cannot reach the normal one,
even by mistake. I added that after a test run wiped the listings I was in the
middle of demoing.

## The endpoints

| Method | Path | What it does |
|---|---|---|
| `POST` | `/agents` | Register an estate agent |
| `GET` | `/agents/:id` | Get one agent |
| `POST` | `/listings` | Add a listing |
| `GET` | `/listings` | List and search, with paging |
| `GET` | `/listings/:id` | Get one listing by its ID |
| `GET` | `/listings/reference/:reference` | Get one listing by its short code, like `EL-YABA23` |
| `PATCH` | `/listings/:id` | Update part of a listing |
| `DELETE` | `/listings/:id` | Delete a listing |
| `GET` | `/health` | Check the app and the database are alive |

`GET /listings/search` also works. It is the same thing as `GET /listings`,
just a second name for it, because that is the path most people try first.

## Why I built it this way

### Agents are real records, not just an ID

An "agent" here is an estate agent. The person or firm marketing the property,
the one a renter calls when they want to see the flat.

At first a listing just stored an agent ID and nothing else. That was wrong in
two ways.

First, the ID pointed at nothing. There was no agents table, so you could post
a listing owned by any random ID you made up and nothing would notice. I tested
it and it went straight through.

Second, and worse, it was useless. Someone browsing sees a flat they like and
wants to ring the agent. All the API could give them was a long random ID.

So agents are now their own table, with a name, a phone number, an email and an
agency if they have one. A listing points at one, and the database enforces it:
if you name an agent who does not exist, the listing is refused. Listings come
back with the agent's name and phone attached, so a buyer has someone to call.

Two smaller decisions inside that:

- **A listing does not have to have an agent.** Plenty of people advertise
  their own property directly. Forcing an agent would just push those callers
  into inventing a fake one, which is worse than having none. So the field is
  optional, and if you do fill it in, it has to be real.
- **The agent's email is not shown on listings.** A search can return 100
  listings, and that would mean handing out 100 email addresses to anyone who
  asked. The name and phone are enough to make contact. The full record is
  there on `/agents/:id` if you need it.

You also cannot delete an agent who still has listings. The database refuses
it, rather than quietly deleting all their properties along with them.

### Searching and listing are the same job

I did not make a separate search endpoint with its own code. Searching is just
listing with filters added.

Every filter is optional. Use none and you get everything. Add
`latitude`, `longitude` and `radiusKm` together and you get the ones nearby,
closest first, each one telling you how far away it is in metres.

```
GET /listings?type=rent&bedrooms=3&minPrice=100000000&maxPrice=500000000
             &latitude=6.4281&longitude=3.4219&radiusKm=20
```

That finds the 3 bedroom flat in Yaba.

Two things to know about that query. `bedrooms=3` means 3 or more, not exactly
3, because someone who wants 2 bedrooms will still take 3. And the prices are
in kobo, so that range means roughly ₦1m to ₦5m a year.

### Finding listings near a point, without reading every row

This is the part I spent the most time on.

The easy way to find listings within 5 km is to measure the distance from your
point to every single listing, then keep the close ones. That works. The
problem is it has to look at every row in the table to do it. With 200
listings you will not notice. With 200,000 you will.

PostGIS solves this. It is an add-on for PostgreSQL that understands
locations. I store the location in a column it understands, and I put a
special index on that column (a GiST index). An index is like the index at the
back of a book. It lets the database jump straight to the listings in that area
instead of reading the whole table.

The trick is that you only get the speed up if you write the query the right
way. I use a function called `ST_DWithin`, which the database can answer from
the index. I only measure the exact distance afterwards, for the few rows that
already passed the filter.

I tested both versions on 50,000 listings:

| How it is written | What the database does | Time |
|---|---|---|
| `ST_DWithin` (what I used) | jumps to the right rows using the index | **48 ms** |
| measure distance on every row | reads all 50,000 rows | 399 ms |

Eight times faster, and the gap gets bigger as the table grows.

This is also why I wrote the database migration by hand instead of letting
TypeORM generate it. TypeORM does not know how to create that kind of index.
If I had let it generate the migration, the index would have been missing and
everything would still have looked fine, just slow.

### Prices are whole numbers, not decimals

Prices are stored in kobo as a whole number. So ₦450,000 is stored as
45,000,000.

Computers cannot store decimal numbers exactly. If you store money as a
decimal, sooner or later ₦2,500,000.00 becomes ₦2,499,999.99. Storing whole
numbers avoids this completely. This is standard practice for money.

Each listing also says what the price means: per year, per night, or a one off
sale price. In Nigeria a rent figure is useless without that. ₦3.5m is a
normal yearly rent in Lekki and a ridiculous monthly one.

### Every listing has two IDs

Each listing has a UUID, which is a long random ID like
`5f14d1fa-6534-49ed-b23f-c4d5cb83c759`. That is good for computers.

It also has a short code like `EL-YABA23`. That is for people. An agent reading
an ID to a client over the phone needs something they can actually say. The
short code leaves out the characters people mix up: `0`, `O`, `1`, `I` and `L`.

The short codes are random, so two could in theory come out the same. The
database refuses duplicates and the app tries again if that happens. A test
creates 40 listings at the same time and checks all 40 codes are different.

### The input is checked twice

Once when the request arrives, and again by the database itself.

The first check gives you a clear error message saying what was wrong. The
second one means a bad listing cannot get in through some other route, like a
script or someone typing SQL by hand.

The app also rejects fields it does not recognise instead of ignoring them. So
nobody can sneak in extra fields and, for example, set their own listing to
"sold" or pick their own ID.

### How the files are arranged

Each feature gets one folder, and everything for that feature lives inside it:
its controller, its service, its database code, and so on. So to understand
listings you open one folder, not seven.

Only one file writes SQL. The code that fetches the results and the code that
counts them share the same filter logic, so the count always matches what you
actually get back. If they drifted apart, your page numbers would be wrong and
it would be a horrible bug to track down.

### Other things included

- **Rate limiting.** One IP address can only make so many requests per minute.
  After that it gets a 429 and is told when to try again.
- **Request logging.** Every request is logged with an ID, so you can follow
  one request through the logs.
- **One error format.** Every error looks the same, whether it is "not found",
  "bad input", "too many requests" or a crash. So whoever is building the app
  that calls this only has to handle one shape. Crashes never leak internal
  details back to the caller.
- **Paging.** You choose the page and how many per page, up to 100. Page
  numbers are capped, which sounds fussy but a huge page number used to crash
  the API with a 500, and it is also an easy way for someone to overload the
  database on purpose.
- **Standard security headers**, and the app refuses to start if its settings
  are missing or wrong, rather than breaking later on the first request.

## What I would do next

**Login and permissions, first.** Agents are real records now and a listing
cannot name one that does not exist. But there is still no login, so nothing
checks that you *are* the agent you claim to be. Anyone who knows an agent's ID
can post listings as them, or delete theirs.

That is the one real gap left, and it was a deliberate choice for a short
exercise. I put the time into the search, the data design and making agents
mean something, and I would rather say that plainly than add a security check
that only looks like one. In a real version the agent would log in, their ID
would come from that login instead of from the request body, and the API would
check you own a listing before letting you change or delete it.

Agent verification belongs in the same piece of work. Fake agents are one of
the biggest trust problems in Nigerian property, so a real version would need a
way to mark an agent as checked, and to show that to buyers.

After that:

- **Caching.** The same searches get repeated constantly. Popular ones could be
  remembered for a short time instead of hitting the database each time.
- **Better paging for big lists.** The current style gets slower the further
  you page, and can repeat or skip rows if listings are being added while you
  browse.
- **Real image uploads.** Right now the API just stores image links. It should
  accept actual uploads, store them properly and resize them, since agents
  upload very large photos.
- **Text search**, so someone can type "ikoyi 3 bedroom" instead of filling in
  separate filter boxes.
- **Monitoring**, especially on how long searches take, since that is the thing
  most likely to get slow first.
- **Address lookup.** Right now you have to send coordinates. Most people type
  an estate or area name, so something needs to turn names into coordinates
  before this API sees them.

## A couple of notes

All database changes go through migration files, which are checked in. The app
never changes the database structure by itself. That feature is convenient
right up until the day it quietly deletes a column.

The bigger tests run against a real database rather than a fake one. The risky
part of this project is the search query itself, and a fake database would only
prove that my code called it, not that it returned the right listings.

Those tests also check the distances the API reports. They work out the
distance separately using a different formula and compare. They agree to within
0.5%. The small difference is because the Earth is not a perfect sphere, and
the API is using the more accurate of the two methods.
