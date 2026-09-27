# Decisions

- TanStack Query for loading data, to have all states and errors handled properly, and simple caching
- TanStack Virtual for rendering large list efficiently
- tygo for generating typescript types from the backend

## What did the spec not tell you?

- anything about projects. I noticed that one person can have many projects assigned.

## What did you notice that looked wrong?

- how hours_per_day are saved(value between 0 - 1), so it's percentage basically

## What did the AI get wrong that you caught?

- It didn't handle the case of loading a lot of data, so I asked to handle pagination on the api side and also virtualization on the frontend side.

## What would you do differently with a week?

- more tests
- I'd move `from` to `to` into the query params state, to allow team members to share links
- sorting the table data
- more accesibility testing
- I'd clean the code more
- spend more time on the backend and checked everything in terms of security, inputs sanitization, and performance
