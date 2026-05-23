# jobs

Base job schema module for `apps/main`.

A job is a persistent record of a long-running background operation (e.g. a task sync). Storing jobs in the DB means progress and failure are visible across requests rather than lost in memory.

This module provides the base `Job` schema. Other modules (e.g. `sync`) extend it via Mongoose discriminators — a single `jobs` collection holds all job types, distinguished by a `__t` field.
