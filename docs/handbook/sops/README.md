# Standard operating procedures

Each SOP says who does it, when, the steps, how to check, and what to do if it goes
wrong. They follow [branching and deployment](../../development/branching-and-deployment.md).
If a step here and that guide disagree, the guide wins; fix the SOP.

| # | SOP | Who | When |
|---|---|---|---|
| 01 | [Making a change and getting it reviewed](01-making-a-change-and-pr-review.md) | Any developer | Every change |
| 02 | [Releasing Web / Admin (website, admin panel, backend)](02-release-web-admin.md) | Kiran, with Anusuya or Mega | Thursdays on the release calendar |
| 03 | [Releasing Mobile (iOS and Android)](03-release-mobile.md) | Kiran, with the developer cutting the build | The Thursday after a Web/Admin release |
| 04 | [Hotfix](04-hotfix.md) | Any developer, approved by Kiran | When production is broken |
| 05 | [Database migrations](05-database-migrations.md) | The developer who changes the schema | Any schema change |
| 06 | [Secrets and access](06-secrets-and-access.md) | Everyone | Always |
| 07 | [Triaging errors in Sentry](07-sentry-triage.md) | Developer on duty | Weekly and after each release |
| 08 | [Admin-panel operations](08-admin-operations.md) | Admin operators | Day to day |

Each SOP ends with the date it was last checked. When you change how something works,
change its SOP in the same PR.

Template for a new SOP: Purpose, Who, When, Before you start, Steps, Check it worked,
If it goes wrong, Last checked.
