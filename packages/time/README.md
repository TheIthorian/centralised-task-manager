# @ctm/time

Zone-aware date arithmetic, shared by `apps/main` and `apps/web` so the server and the browser
cannot disagree about which calendar day an instant falls on.

Every function takes an explicit IANA `timeZone`. Nothing here reads the machine's clock or its
local offset, so a caller has to say whose day it means.

```ts
import { toDateKey, startOfDay, addDays, instantFromWallClock } from '@ctm/time';

toDateKey({ instant: new Date('2026-07-13T23:30:00Z'), timeZone: 'Pacific/Auckland' }); // '2026-07-14'
instantFromWallClock({ dateKey: '2026-07-14', hour: 9, timeZone: 'Pacific/Auckland' });
```

All-day due dates are read and written in `UTC`, so they name one calendar day worldwide. Timed
due dates are read in the viewer's own zone.

Tests run under `TZ=Pacific/Chatham`, a zone offset by 45 minutes from the hour, so a reintroduced
local-clock call fails rather than passing by luck on a UTC machine.
