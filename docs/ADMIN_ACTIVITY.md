# Admin student activity

Open **Admin → Student Activity** to view daily submissions, active students,
first completions, a student overview, student calendars and recent submission
timelines, and exercise totals. Reports support a date range of up to 366 days,
language/chapter filters, and optional inclusion of archived students. Student
names and emails can be searched, and the overview can be sorted by each metric.

All reporting endpoints require the shared admin role check:

- `GET /api/admin/activity/filters`
- `GET /api/admin/activity?start=YYYY-MM-DD&end=YYYY-MM-DD&timezone=Europe/Brussels`
- `GET /api/admin/activity/students/:id` with the same filters

Optional filters are `language`, `chapter`, and `includeArchived=true`. Admin
accounts, including admins determined by environment email/domain settings,
are excluded from student reporting. Archived students are excluded by default.

## What the numbers mean

- **Submissions** are graded runs in `submission_attempts`, including failed runs.
- **Practice days** count distinct local calendar days with a submission that was
  not recorded as a configuration error.
- **Exercises attempted** count distinct exercises with such a submission.
- **Active students** have at least one such submission within the selected dates.
- **First completions** use permanent `user_progress.completed_at` timestamps.
  Successful reruns do not add another completion.
- **Configuration errors** use the recorded `configuration_error` category. Older
  records cannot supply information that was not logged at the time.
- **Last submission** is the latest recorded run within the selected filters.
- **Runtime** is the recorded execution duration, not time spent studying.

Dates are inclusive and use an IANA timezone, defaulting to `Europe/Brussels`.
Set `ACTIVITY_TIMEZONE` to change the default. Daylight-saving changes are handled
at calendar-day boundaries. The detail timeline shows the 200 most recent runs;
the calendar and totals cover the whole selected range.

The page identifies the beginning of recorded submission history. It does not
invent activity from older cumulative counters. Existing completion timestamps
can predate submission history. Language/chapter filters use exercises' current
assignments; changing those assignments also changes historical grouping.

## Data preservation and rollout

The feature reuses existing submission history and progress. No new activity
events, code snapshots, keystroke tracking, or study-time estimates are collected.
The startup migration adds three `CREATE INDEX IF NOT EXISTS` indexes. It does
not delete rows, rebuild tables, or rewrite historical records.

Deploy the committed files and restart the application normally to register the
routes and add the indexes. The migration and reports are tested with an
in-memory database, including preservation, admin access, reruns, configuration
errors, archived students, and spring/autumn daylight-saving boundaries.
