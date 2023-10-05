Changelog
=========

Version 0.2.1 (October, 5, 2023)
--------------------------------

Minor release, incorporate major bug fixes and recomendations from OHBM meeting.

* [FIX] unique already creates an index, unique made a repetitive index (#600) @jdkent
* [ENH] add base_study attribute (#599) @jdkent
* [FIX] ignore string if doi/pmid/name string is empty (#598) @jdkent
* [ENH] add conditions and weights to specification (#597) @jdkent
* [ENH] add studyset-references endpoint (#596) @jdkent
* chore(deps): bump @cypress/request and cypress in /compose/neurosynth-frontend (#595) @dependabot
* 197 display user icon name (#591) @nicoalee
* [ENH] add username and neurostore studyset script (#590) @jdkent
* [FIX] nick feedback (#589) @jdkent
* [ENH] add usernames to compose (#588) @jdkent
* [MAINT] update openapi to main branch (#586) @jdkent
* [ENH] bulk upload (#585) @jdkent
* 565 update the advanced search input (#583) @nicoalee
* [ENH] add username as resource attribute (#584) @jdkent
* 561 switch api from studies to abstract studies (#582) @nicoalee
* [FIX] id not showing up for info=true (#581) @jdkent
* [ENH] using an iterator over a list comprehension should be faster (#578) @jdkent
* [FIX] add data_type to base_study (#577) @jdkent
* [FIX] info query param behavior (#576) @jdkent
* [ENH] make it quicker to filter studies by whether they have images/points. (#574) @jdkent
* chore(deps): bump tough-cookie and @cypress/request in /compose/neurosynth-frontend (#569) @dependabot


Version 0.2 (August, 22, 2023)
--------------------------------

Post-OHBM major release. Includes a wide array of major improvements, including 

## What's Changed
* feat: updated node and react scripts by @nicoalee in https://github.com/neurostuff/neurostore/pull/352
* 307 refactor loading and http requests using react query by @nicoalee in https://github.com/neurostuff/neurostore/pull/362
* feat: updated tests and removed old types by @nicoalee in https://github.com/neurostuff/neurostore/pull/365
* feat: add create meta-analysis button by @nicoalee in https://github.com/neurostuff/neurostore/pull/366
* feat: added redirect to created meta-analysis and unit tests by @nicoalee in https://github.com/neurostuff/neurostore/pull/367
* 361 improve meta analysis summary page by @nicoalee in https://github.com/neurostuff/neurostore/pull/368
* [TEST] skip tests if external service is not working by @jdkent in https://github.com/neurostuff/neurostore/pull/353
* [ENH] add studyset link by @jdkent in https://github.com/neurostuff/neurostore/pull/364
* 363 add ability to delete studies by @nicoalee in https://github.com/neurostuff/neurostore/pull/373
* [FIX] data type both by @jdkent in https://github.com/neurostuff/neurostore/pull/375
* [FIX] add httpx until schemathesis is fixed by @jdkent in https://github.com/neurostuff/neurostore/pull/378
* 371 enhance study search view to add studysets that a study is part of with better study addremove functionality by @nicoalee in https://github.com/neurostuff/neurostore/pull/377
* 356 add search for studysets by @nicoalee in https://github.com/neurostuff/neurostore/pull/379
* [ENH] change workflow to incorporate data for frontend tests by @jdkent in https://github.com/neurostuff/neurostore/pull/372
* [FIX] flask sqlalchemy by @jdkent in https://github.com/neurostuff/neurostore/pull/385
* [MAINT] use tilde versioning on dependencies by @jdkent in https://github.com/neurostuff/neurostore/pull/387
* [REF] neurosynth to compose by @jdkent in https://github.com/neurostuff/neurostore/pull/386
* [ENH] add meta analysis provenance by @jdkent in https://github.com/neurostuff/neurostore/pull/389
* [ENH] add project table by @jdkent in https://github.com/neurostuff/neurostore/pull/393
* feat: added plausible by @nicoalee in https://github.com/neurostuff/neurostore/pull/392
* [FIX] allow project to be null by @jdkent in https://github.com/neurostuff/neurostore/pull/395
* [FIX] add annotations when analysis is added, not just study by @jdkent in https://github.com/neurostuff/neurostore/pull/397
* Add/improve documentation by @jdkent in https://github.com/neurostuff/neurostore/pull/333
* [ENH] Add upload process (celery) by @jdkent in https://github.com/neurostuff/neurostore/pull/332
* [FIX] add new analysis annotation by @jdkent in https://github.com/neurostuff/neurostore/pull/402
* [FIX] celery tests by @jdkent in https://github.com/neurostuff/neurostore/pull/405
* [MAINT] delete compose packages by @jdkent in https://github.com/neurostuff/neurostore/pull/409
* [FIX] add api in context of current app by @jdkent in https://github.com/neurostuff/neurostore/pull/410
* [FIX] increase page size limit by @jdkent in https://github.com/neurostuff/neurostore/pull/414
* [FIX] only debug when specified by @jdkent in https://github.com/neurostuff/neurostore/pull/413
* [FIX] handled numeric input parse by @jdkent in https://github.com/neurostuff/neurostore/pull/416
* [REF] list user args by @jdkent in https://github.com/neurostuff/neurostore/pull/415
* [FIX] compose tests by @jdkent in https://github.com/neurostuff/neurostore/pull/418
* [FIX] study unique query by @jdkent in https://github.com/neurostuff/neurostore/pull/417
* [FIX] neurosynth ingestion by @jdkent in https://github.com/neurostuff/neurostore/pull/419
* change to refactored openapi by @jdkent in https://github.com/neurostuff/neurostore/pull/420
* [FIX] annotations not updating properly (again) by @jdkent in https://github.com/neurostuff/neurostore/pull/421
* [FIX] POST meta-analysis with project by @jdkent in https://github.com/neurostuff/neurostore/pull/424
* [ENH] upload neurostore table from results by @jdkent in https://github.com/neurostuff/neurostore/pull/422
* [FIX] update openapi spec by @jdkent in https://github.com/neurostuff/neurostore/pull/427
* [ENH] project public private by @jdkent in https://github.com/neurostuff/neurostore/pull/428
* [FIX] create neurostore study when project is created by @jdkent in https://github.com/neurostuff/neurostore/pull/439
* [FIX] compose bot by @jdkent in https://github.com/neurostuff/neurostore/pull/440
* [FIX] junit tests by @jdkent in https://github.com/neurostuff/neurostore/pull/441
* 381 restructure user experience with meta first approach by @nicoalee in https://github.com/neurostuff/neurostore/pull/399
* [FIX] upload key name by @jdkent in https://github.com/neurostuff/neurostore/pull/442
* chore(deps): bump @sideway/formula from 3.0.0 to 3.0.1 in /compose/neurosynth-frontend by @dependabot in https://github.com/neurostuff/neurostore/pull/404
* chore(deps): bump json5 from 1.0.1 to 1.0.2 in /compose/neurosynth-frontend by @dependabot in https://github.com/neurostuff/neurostore/pull/398
* [FIX] celery context by @jdkent in https://github.com/neurostuff/neurostore/pull/445
* feat: prevent scroll from changing number input, better support for e… by @nicoalee in https://github.com/neurostuff/neurostore/pull/444
* chore(deps): bump webpack from 5.74.0 to 5.83.1 in /compose/neurosynth-frontend by @dependabot in https://github.com/neurostuff/neurostore/pull/443
* [FIX] schemas by @jdkent in https://github.com/neurostuff/neurostore/pull/446
* [FIX] show diagnostic table at endpoint by @jdkent in https://github.com/neurostuff/neurostore/pull/447
* chore(deps-dev): bump jsonwebtoken from 8.5.1 to 9.0.0 in /compose/neurosynth-frontend by @dependabot in https://github.com/neurostuff/neurostore/pull/396
* chore(deps): bump decode-uri-component from 0.2.0 to 0.2.2 in /compose/neurosynth-frontend by @dependabot in https://github.com/neurostuff/neurostore/pull/394
* chore(deps): bump loader-utils from 2.0.2 to 2.0.4 in /compose/neurosynth-frontend by @dependabot in https://github.com/neurostuff/neurostore/pull/391
* feat: set the same order for all analyses - alphabetically by analysi… by @nicoalee in https://github.com/neurostuff/neurostore/pull/448
* feat: add default studyset name and description by @nicoalee in https://github.com/neurostuff/neurostore/pull/454
* feat: added more info for selecting a study by @nicoalee in https://github.com/neurostuff/neurostore/pull/456
* feat: updated save button sitting below annotations by @nicoalee in https://github.com/neurostuff/neurostore/pull/460
* 434 coordinate editing ability to add more than one row at a time by @nicoalee in https://github.com/neurostuff/neurostore/pull/463
* feat: removed autofill name for meta analysis by @nicoalee in https://github.com/neurostuff/neurostore/pull/464
* feat: made links clickable for study display by @nicoalee in https://github.com/neurostuff/neurostore/pull/466
* [FIX] swagger ui fix with prance by @jdkent in https://github.com/neurostuff/neurostore/pull/467
* [ENH] results endpoint improvements by @jdkent in https://github.com/neurostuff/neurostore/pull/462
* [FIX] null results by @jdkent in https://github.com/neurostuff/neurostore/pull/468
* [FIX] add new fields to point by @jdkent in https://github.com/neurostuff/neurostore/pull/469
* [FIX] update openapi spec by @jdkent in https://github.com/neurostuff/neurostore/pull/470
* [FIX] make value a float by @jdkent in https://github.com/neurostuff/neurostore/pull/471
* 436 proposal for coordinate table organization by @nicoalee in https://github.com/neurostuff/neurostore/pull/472
* [ENH] make the studies endpoint query faster by @jdkent in https://github.com/neurostuff/neurostore/pull/474
* [ENH] add order to Points object by @jdkent in https://github.com/neurostuff/neurostore/pull/475
* [FIX] add order and status by @jdkent in https://github.com/neurostuff/neurostore/pull/477
* [FIX] try to catch more errors on analysis creation by @jdkent in https://github.com/neurostuff/neurostore/pull/478
* [FIX] allow bot to add analysis to study owned by user by @jdkent in https://github.com/neurostuff/neurostore/pull/479
* [FIX] neurostore analysis upload by @jdkent in https://github.com/neurostuff/neurostore/pull/481
* [FIX] make analysis upload a task by @jdkent in https://github.com/neurostuff/neurostore/pull/482
* [ENH] use outerjoins to display studies by @jdkent in https://github.com/neurostuff/neurostore/pull/483
* 455 upload workflow post meta analysis run by @nicoalee in https://github.com/neurostuff/neurostore/pull/491
* chore(deps): bump fast-xml-parser from 4.0.12 to 4.2.4 in /compose/neurosynth-frontend by @dependabot in https://github.com/neurostuff/neurostore/pull/484
* feat: added semantic scholar to provide full text by @nicoalee in https://github.com/neurostuff/neurostore/pull/492
* 488 make sample size a default metadata key when the user owns the study by @nicoalee in https://github.com/neurostuff/neurostore/pull/493
* [ENH] abstract study by @jdkent in https://github.com/neurostuff/neurostore/pull/486
* [ENH] switch missing names to base_studies by @jdkent in https://github.com/neurostuff/neurostore/pull/495
* [ENH] Add sqltap by @jdkent in https://github.com/neurostuff/neurostore/pull/496
* [FIX] fix the study search endpoint by @jdkent in https://github.com/neurostuff/neurostore/pull/497
* [FIX] search capabilities by @jdkent in https://github.com/neurostuff/neurostore/pull/498
* feat: finished user improvements from feedback by @nicoalee in https://github.com/neurostuff/neurostore/pull/499
* feat: updated links for navbar docs and neurovault by @nicoalee in https://github.com/neurostuff/neurostore/pull/501
* bugfix: save tags by @nicoalee in https://github.com/neurostuff/neurostore/pull/504
* bugfix: handled non prisma case for exclusion selector popup by @nicoalee in https://github.com/neurostuff/neurostore/pull/506
* [ENH] allow multiword queries by @jdkent in https://github.com/neurostuff/neurostore/pull/512
* [ENH] add load_testing config by @jdkent in https://github.com/neurostuff/neurostore/pull/523
* [ENH] misc performance by @jdkent in https://github.com/neurostuff/neurostore/pull/526
* feat: added handling of expired tokens and handling of updates betwee… by @nicoalee in https://github.com/neurostuff/neurostore/pull/511
* chore(deps): bump fast-xml-parser from 4.2.4 to 4.2.5 in /compose/neurosynth-frontend by @dependabot in https://github.com/neurostuff/neurostore/pull/524
* chore(deps): bump semver from 6.3.0 to 6.3.1 in /compose/neurosynth-frontend by @dependabot in https://github.com/neurostuff/neurostore/pull/525
* Enh/add caching by @jdkent in https://github.com/neurostuff/neurostore/pull/527
* [FIX] bump gunicorn workers and change nested back to subquery by @jdkent in https://github.com/neurostuff/neurostore/pull/528
* [FIX] nested query by @jdkent in https://github.com/neurostuff/neurostore/pull/529
* [FIX] studyset nested by @jdkent in https://github.com/neurostuff/neurostore/pull/530
* feat: removed mark all as complete button if all are complete by @nicoalee in https://github.com/neurostuff/neurostore/pull/531
* fix: resolved bugs with out of sync curation, resolved issue with mis… by @nicoalee in https://github.com/neurostuff/neurostore/pull/533
* [FIX] switch caching strategy to redis by @jdkent in https://github.com/neurostuff/neurostore/pull/532
* feat: put specification details last when creating spec, improved int… by @nicoalee in https://github.com/neurostuff/neurostore/pull/534
* [ENH] add info and flat query parameters by @jdkent in https://github.com/neurostuff/neurostore/pull/535
* feat: add flat by @nicoalee in https://github.com/neurostuff/neurostore/pull/538
* feat: set cloned study annotations to be included by default by @nicoalee in https://github.com/neurostuff/neurostore/pull/540
* [ENH] ACE Ingestion by @jdkent in https://github.com/neurostuff/neurostore/pull/536
* feat: remove alpha from site and add to labels by @nicoalee in https://github.com/neurostuff/neurostore/pull/555
* [FIX] flake8 errors by @jdkent in https://github.com/neurostuff/neurostore/pull/568
* feat: add google analytics by @nicoalee in https://github.com/neurostuff/neurostore/pull/560
* feat: added neurosynth logo as favicon and change default text by @nicoalee in https://github.com/neurostuff/neurostore/pull/558
* chore(deps): bump word-wrap from 1.2.3 to 1.2.4 in /compose/neurosynth-frontend by @dependabot in https://github.com/neurostuff/neurostore/pull/542
* codespell: config, workflow + typos fixed by @yarikoptic in https://github.com/neurostuff/neurostore/pull/541
* [MAINT] update openapi by @jdkent in https://github.com/neurostuff/neurostore/pull/571
* [FIX/ENH] usernames by @jdkent in https://github.com/neurostuff/neurostore/pull/570
* [FIX] ignore sample_text by @jdkent in https://github.com/neurostuff/neurostore/pull/572

## New Contributors
* @yarikoptic made their first contribution in https://github.com/neurostuff/neurostore/pull/541

**Full Changelog**: https://github.com/neurostuff/neurostore/compare/v0.1...v0.2

Version 0.1 (September, 7, 2022)
--------------------------------


This is the first versioned release of neurostore. The main items implemented are:
- backend for storing coordinate/image based studies (neurostore.org)
- backend for creating meta-analyses (compose.neurosynth.org)
- frontend for interfacing with both backends
This release represents a functional website for using previously ingested studies to create studysets, specify meta-analyses and run those meta-analyses on a google collab notebook. 

* [REF] Set up docker-compose, and other boilerplate by @adelavega in https://github.com/neurostuff/neurostore/pull/3
* [REF] Move to Python 3.8, add tests by @adelavega in https://github.com/neurostuff/neurostore/pull/8
* [REF] Drop Flask-Restful by @adelavega in https://github.com/neurostuff/neurostore/pull/9
* [ENH] Remove initialization of database by @jdkent in https://github.com/neurostuff/neurostore/pull/16
* [FIX] DockerTestConfig by @jdkent in https://github.com/neurostuff/neurostore/pull/15
* [ENH] Add OpenAPI Specification by @jdkent in https://github.com/neurostuff/neurostore/pull/19
* [ENH, FIX] Deploy behind nginx-proxy by @tyarkoni in https://github.com/neurostuff/neurostore/pull/24
* [ENH] post/get datasets by @jdkent in https://github.com/neurostuff/neurostore/pull/29
* [REF] use id's only instead of IRIs by @jdkent in https://github.com/neurostuff/neurostore/pull/26
* [STY] run black and check style with flake8 by @jdkent in https://github.com/neurostuff/neurostore/pull/30
* [ENH] add login by @jdkent in https://github.com/neurostuff/neurostore/pull/33
* [ENH] Add cloning functionality by @jdkent in https://github.com/neurostuff/neurostore/pull/36
* [FIX] neurovault ingestion by @jdkent in https://github.com/neurostuff/neurostore/pull/39
* [ENH] Add Condition POST by @jdkent in https://github.com/neurostuff/neurostore/pull/40
* [FIX] minor fixes by @jdkent in https://github.com/neurostuff/neurostore/pull/57
* [FIX] reference original parent when cloning by @jdkent in https://github.com/neurostuff/neurostore/pull/58
* [FIX] conform test cases to openapi standard by @jdkent in https://github.com/neurostuff/neurostore/pull/61
* [REF] use Auth0 for authentication by @jdkent in https://github.com/neurostuff/neurostore/pull/67
* [ENH] pagination by @jdkent in https://github.com/neurostuff/neurostore/pull/72
* [FIX] urls in example_config by @jdkent in https://github.com/neurostuff/neurostore/pull/78
* [FIX] cloning studies with images by @jdkent in https://github.com/neurostuff/neurostore/pull/80
* [REF] add query parameters and filters to display only original studies by @jdkent in https://github.com/neurostuff/neurostore/pull/82
* [ENH] New neurosynth format by @jdkent in https://github.com/neurostuff/neurostore/pull/86
* [REF] merge the frontend with the backend by @nicoalee in https://github.com/neurostuff/neurostore/pull/88
* [FIX] Do no include id in PUT requests by @jdkent in https://github.com/neurostuff/neurostore/pull/90
* [REF] database changes by @jdkent in https://github.com/neurostuff/neurostore/pull/93
* [ENH] Ingestion by @jdkent in https://github.com/neurostuff/neurostore/pull/95
* [TST] add tests by @nicoalee in https://github.com/neurostuff/neurostore/pull/97
* [FIX] public/private distinction by @jdkent in https://github.com/neurostuff/neurostore/pull/96
* [MAINT] update spec by @jdkent in https://github.com/neurostuff/neurostore/pull/103
* [MAINT] upgrade react materials to MUI V5 by @nicoalee in https://github.com/neurostuff/neurostore/pull/105
* [ENH] add pagination by @nicoalee in https://github.com/neurostuff/neurostore/pull/106
* [ENH] run frontend by @jdkent in https://github.com/neurostuff/neurostore/pull/108
* [ENH] basic search filtering by @nicoalee in https://github.com/neurostuff/neurostore/pull/109
* [ENH] edit enhancements by @nicoalee in https://github.com/neurostuff/neurostore/pull/114
* [MNT] update staging by @jdkent in https://github.com/neurostuff/neurostore/pull/115
* [FIX] add try_file in nginx by @jdkent in https://github.com/neurostuff/neurostore/pull/118
* [TST] add frontend tests by @jdkent in https://github.com/neurostuff/neurostore/pull/116
* [MAINT] updated gitignore with postgres py migration files and added e… by @nicoalee in https://github.com/neurostuff/neurostore/pull/120
* [DOC] added build steps for dev and staging and updated readme by @nicoalee in https://github.com/neurostuff/neurostore/pull/123
* [FIX] code review improvements by @nicoalee in https://github.com/neurostuff/neurostore/pull/125
* [ENH] datasets & annotations by @jdkent in https://github.com/neurostuff/neurostore/pull/126
* [REF] docker compose init procedure by @jdkent in https://github.com/neurostuff/neurostore/pull/135
* [FIX] images add date by @jdkent in https://github.com/neurostuff/neurostore/pull/137
* [REF] restructure code by @jdkent in https://github.com/neurostuff/neurostore/pull/139
* [ENH] add analyses to study view by @nicoalee in https://github.com/neurostuff/neurostore/pull/143
* [ENH] cloning a study will redirect to that study, log out bug fixed by @nicoalee in https://github.com/neurostuff/neurostore/pull/150
* [FIX] map port 80 again by @jdkent in https://github.com/neurostuff/neurostore/pull/153
* [ENH] study analyses editing by @nicoalee in https://github.com/neurostuff/neurostore/pull/156
* [ENH] add delete operation to all endpoints by @jdkent in https://github.com/neurostuff/neurostore/pull/165
* [ENH] implement datasets by @nicoalee in https://github.com/neurostuff/neurostore/pull/174
* [FIX] add health command for postgres by @jdkent in https://github.com/neurostuff/neurostore/pull/177
* [MAINT] update spec by @jdkent in https://github.com/neurostuff/neurostore/pull/179
* [ENH] add export option to annotations by @jdkent in https://github.com/neurostuff/neurostore/pull/181
* [MAINT] annotations/tests by @jdkent in https://github.com/neurostuff/neurostore/pull/188
* [MAINT] change openapi branch to main by @jdkent in https://github.com/neurostuff/neurostore/pull/189
* [MAINT] installation by @jdkent in https://github.com/neurostuff/neurostore/pull/190
* [ENH] study year by @jdkent in https://github.com/neurostuff/neurostore/pull/192
* [FIX] userview by @jdkent in https://github.com/neurostuff/neurostore/pull/199
* [MAINT] add ipython to command `flask shell` by @jdkent in https://github.com/neurostuff/neurostore/pull/200
* [FIX] public private by @jdkent in https://github.com/neurostuff/neurostore/pull/201
* [ENH] Coordinate/Image search by @jdkent in https://github.com/neurostuff/neurostore/pull/202
* [FIX] update annotations when adding study to dataset by @jdkent in https://github.com/neurostuff/neurostore/pull/208
* [ENH] annotation key by @jdkent in https://github.com/neurostuff/neurostore/pull/212
* [FEAT] Add Annotations Page by @jdkent in https://github.com/neurostuff/neurostore/pull/193
* [ENH] add neurosynth2 by @jdkent in https://github.com/neurostuff/neurostore/pull/218
* [FIX] maint by @jdkent in https://github.com/neurostuff/neurostore/pull/222
* [FIX] spec conformance by @jdkent in https://github.com/neurostuff/neurostore/pull/223
* [FIX] initialize annotation with empty notes by @jdkent in https://github.com/neurostuff/neurostore/pull/224
* [ENH] added appzi feedback widget by @nicoalee in https://github.com/neurostuff/neurostore/pull/229
* [REF] moved neurosynth-frontend to synth folder by @nicoalee in https://github.com/neurostuff/neurostore/pull/230
* [FIX] removed notes property from payload by @nicoalee in https://github.com/neurostuff/neurostore/pull/233
* [ENH] 234 add owner column to annotations by @nicoalee in https://github.com/neurostuff/neurostore/pull/240
* [TST] point test by @jdkent in https://github.com/neurostuff/neurostore/pull/246
* [ENH] make nested queries faster by @jdkent in https://github.com/neurostuff/neurostore/pull/239
* [ENH] convert datasets to studysets by @jdkent in https://github.com/neurostuff/neurostore/pull/242
* [FIX] missing change from dataset to studyset by @jdkent in https://github.com/neurostuff/neurostore/pull/250
* [MAINT] update openapi spec by @jdkent in https://github.com/neurostuff/neurostore/pull/251
* [Fix] entity by @jdkent in https://github.com/neurostuff/neurostore/pull/256
* [FIX] change kwargs to metadata in schemas by @jdkent in https://github.com/neurostuff/neurostore/pull/257
* [ENH] study editor: add/remove/update conditions by @jdkent in https://github.com/neurostuff/neurostore/pull/244
* [REF] 258 integrate sdk into frontend and cicd pipeline by @nicoalee in https://github.com/neurostuff/neurostore/pull/260
* [ENH] update spec by @jdkent in https://github.com/neurostuff/neurostore/pull/272
* [ENH] ingest neurostore data by @jdkent in https://github.com/neurostuff/neurostore/pull/273
* [FIX] neurosynth endpoint by @jdkent in https://github.com/neurostuff/neurostore/pull/274
* [TST] schemathesis robustness by @jdkent in https://github.com/neurostuff/neurostore/pull/276
* [FIX] add missing fields specification schema by @jdkent in https://github.com/neurostuff/neurostore/pull/278
* [DOC] include documentation for the neurosynth spec by @jdkent in https://github.com/neurostuff/neurostore/pull/282
* [ENH] add frontend config by @jdkent in https://github.com/neurostuff/neurostore/pull/249
* [REF] Split nimads by @jdkent in https://github.com/neurostuff/neurostore/pull/287
* [ENH] 113 edit enhancements involving addremoveupdate points by @nicoalee in https://github.com/neurostuff/neurostore/pull/290
* [FIX] Remove unused function by @jdkent in https://github.com/neurostuff/neurostore/pull/289
* [REF] prepare compose.neurosynth.org by @jdkent in https://github.com/neurostuff/neurostore/pull/294
* [ENH] 292 rework landing page and improve performance by @nicoalee in https://github.com/neurostuff/neurostore/pull/297
* [FIX] fix: resolved bug with ids set to same id by @nicoalee in https://github.com/neurostuff/neurostore/pull/302
* [FIX] nginx GZIP javascript content by @jdkent in https://github.com/neurostuff/neurostore/pull/301
* [ENH] 292 rework landing page and improve performance by @nicoalee in https://github.com/neurostuff/neurostore/pull/303
* [DOCS] Mkdoc/neurosynth by @jdkent in https://github.com/neurostuff/neurostore/pull/304
* [ENH] 292 rework landing page and improve performance by @nicoalee in https://github.com/neurostuff/neurostore/pull/306
* [FIX] add explicit indices and remove subquery load from analysis-conditions by @jdkent in https://github.com/neurostuff/neurostore/pull/324
* [ENH] feat: added add button to studypage and refactored code to move study set add/update logic to studysetpopupmenu component by @nicoalee in https://github.com/neurostuff/neurostore/pull/336
* [ENH] create tour by @jdkent in https://github.com/neurostuff/neurostore/pull/334
* [ENH] feat: made logo clickable by @nicoalee in https://github.com/neurostuff/neurostore/pull/337
* [FIX] 312 handle situation when authenticated user tries to update studies studysets meta analyses that are not theirs by @nicoalee in https://github.com/neurostuff/neurostore/pull/338
* [FIX] feat: allowed viewport to shrink more without turning into hamburger menu, moved drawer to right side by @nicoalee in https://github.com/neurostuff/neurostore/pull/339
* [ENH] 309 add ability to delete study from studyset by @nicoalee in https://github.com/neurostuff/neurostore/pull/340
* [ENH] feat: added studies link for empty studysets by @nicoalee in https://github.com/neurostuff/neurostore/pull/342
* [ENH] feat: not found page implemented by @nicoalee in https://github.com/neurostuff/neurostore/pull/344
* [ENH] 310 create protected routes for edit pages by @nicoalee in https://github.com/neurostuff/neurostore/pull/346
* [ENH] 329 add warning are you sure prompt if the user tries to clone a cloned study by @nicoalee in https://github.com/neurostuff/neurostore/pull/347
* [REF] use nimads repo by @jdkent in https://github.com/neurostuff/neurostore/pull/348
* [ENH] 231 search improvements by @nicoalee in https://github.com/neurostuff/neurostore/pull/349
* [ENH] add release drafter action and template by @jdkent in https://github.com/neurostuff/neurostore/pull/354

## New Contributors
* @adelavega made their first contribution in https://github.com/neurostuff/neurostore/pull/3
* @tyarkoni made their first contribution in https://github.com/neurostuff/neurostore/pull/24
* @nicoalee made their first contribution in https://github.com/neurostuff/neurostore/pull/88
