# Contributors guidelines

This document summarizes the most important points for people interested in
contributing, especially via bug reports or pull requests.

## Table of contents

- [Reporting bugs](#reporting-bugs)
- [Proposing features or improvements](#proposing-features-or-improvements)
- [Contributing pull requests](#contributing-pull-requests)

## Reporting bugs

Report bugs [here](https://github.com/fourgames/resources/issues/new).

Make sure that the bug you are experiencing is reproducible in the latest Godot
release.

## Proposing features or improvements

Feature proposal [here](https://github.com/fourgames/resources/discussions/new?category=ideas).

## Contributing pull requests

If you want to add new features, please make sure that:

- This functionality is desired, which means that it solves a common use case
  that several users will need in their real-life projects.
- You talked to other developers on how to implement it best.
- Even if it doesn't get merged, your PR is useful for future work by another
  developer.

Similar rules can be applied when contributing bug fixes - it's always best to
discuss the implementation in the bug report first if you are not 100% about
what would be the best fix.

### Be mindful of your commits

Try to make simple PRs that handle one specific topic. Just like for reporting
issues, it's better to open 3 different PRs that each address a different issue
than one big PR with three commits. This makes it easier to review, approve, and
merge the changes independently.

When updating your fork with upstream changes, please use ``git pull --rebase``
to avoid creating "merge commits". Those commits unnecessarily pollute the git
history when coming from PRs.

Also try to make commits that bring the project from one stable state to another
stable state, i.e. if your first commit has a bug that you fixed in the second
commit, try to merge them together before making your pull request. This
includes fixing build issues or typos, adding documentation, etc.

### Format your commit messages with readability in mind

The way you format your commit messages is quite important to ensure that the
commit history and changelog will be easy to read and understand. A Git commit
message is formatted as a short title (first line) and an extended description
(everything after the first line and an empty separation line).

The short title is the most important part, as it is what will appear in the
changelog or in the GitHub interface unless you click the "expand" button.
Try to keep that first line under 72 characters, but you can go slightly above
if necessary to keep the sentence clear.

It should be written in English, starting with a capital letter, and usually
with a verb in imperative form. A typical bugfix would start with "Fix", while
the addition of a new feature would start with "Add".

If your commit fixes a reported issue, please include it in the _description_
of the PR (not in the title, or the commit message) using one of the
[GitHub closing keywords](https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue)
such as "Fixes #1234". This will cause the issue to be closed automatically if
the PR is merged. Adding it to the commit message is easier, but adds a lot of
unnecessary updates in the issue distracting from the thread.

**Note:** When using the GitHub online editor or its drag-and-drop
feature, *please* edit the commit title to something meaningful. Commits named
"Update my_file.cpp" won't be accepted.

### Document your changes

If your pull request modifies parts of the code in a non-obvious way, make sure
to add comments in the code as well. This helps other people understand the
change without having to dive into the Git history.

## Communicating with developers

To communicate with developers (e.g. to discuss a feature you want to implement
or a bug you want to fix), the following channels can be used:

- [Bug tracker](https://github.com/fourgames/resources/issues): If there is an
  existing issue about a topic you want to discuss, you can participate directly.
  If not, you can open a new issue. Please mind the guidelines outlined above
  for bug reporting.
- [Feature proposals](https://github.com/fourgames/resources/discussions):
  To propose a new feature start a new discussion [here](https://github.com/fourgames/resources/discussions/new?category=ideas). Don't
  hesitate to start by talking about your idea to make sure that it makes sense in resources's context.

Thanks for your interest in contributing!

—The Four Games team
