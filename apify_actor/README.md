# apify_actor (intentionally empty)

Person B owns the Apify Actor that scrapes Uber Eats, DoorDash, and Grubhub
quote data. Their source code lives in their own repo and is deployed to
Apify; it is **not** vendored here.

The MealDeal extension and `mealdeal-api` bridge use the contract defined
in `mealdeal-extension/src/lib/types.ts` (and the mirror in
`mealdeal-api/lib/types.ts`), which matches Person B's `MealDealResult`
shape. As long as the Actor conforms to that shape, nothing in this
directory is required.

To point the API at the deployed Actor, set in `mealdeal-api/.env`:

```
APIFY_TOKEN=<your Apify personal API token>
APIFY_ACTOR_ID=<username>~<actor-name>
```
