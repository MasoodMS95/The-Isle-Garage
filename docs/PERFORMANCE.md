# Sharing and loading measurements

Measured 2026-09-08 using completed HTTP requests (not UI-automation command durations). No production accounts, mutations or emails were used. Initial production read-only samples from this machine: health201ms, login231ms, original wetlandPNG333ms/2189960bytes, new serviceWebP253ms/201560bytes. These are single network samples, not a latency benchmark.

The table below is local Next development server + isolated PostgreSQL17, synthetic verified user, loopbackHTTP, one warmup then7 completed requests per path. It includes development overhead and must not be interpreted as production/mobile user latency.

| Request | Median ms | Min–max ms | Response bytes |
| --- | ---: | ---: | ---: |
| owner garage GET | 13.6 | 12.6–14.3 | 70 |
| garage PUT durable acknowledgement | 17.2 | 15.9–17.7 | 356 |
| owner profile GET | 11.7 | 10.1–12.7 | 103 |
| public profile API | 10.3 | 9.1–14.7 | 428 |
| public page | 57.4 | 32.3–270.1 | 13928 |
| public OG image | 34.9 | 31.6–44.3 | 54031 |
| wetland original PNG | 11 | 9.6–12.3 | 2189960 |
| wetland delivered WebP | 5.3 | 5–6 | 156102 |

The measured asset problem is size: original wetland+paddockPNG payload4485486bytes is replaced by308212bytes ofWebP (93.1% smaller), originals retained. All four delivered stills total686392bytes. Camera switches wait for decode so captions do not get ahead of the image.

Source inspection also found an unbounded chain of queued whole-garage saves and awaited optional Discord requests before save acknowledgement. The queue now skips superseded pending snapshots while retaining serial writes/version checks; optional bot sync runs after the durable response. These are bounded-path improvements, not proof that Discord caused the reported production slowness (it is disabled there). Public profile data uses one joined query; metadata/page share request-local memoization, never a persistent visibility cache.

No measured evidence yet supports a multi-second server bottleneck. Database request timings above are small locally; production network, browser rendering, user dataset scale and actual interactive delay need deployment/QE follow-up. The existing450ms autosave debounce remains intentional. Repeat cold/warm mobile measurements with developertools before making broader render or infrastructure changes.
