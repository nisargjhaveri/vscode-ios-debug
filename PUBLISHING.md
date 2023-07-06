1. Commit and validate all the changes so far.
1. Update CHANGELOG.md for the new version. Make sure you don't have any other changes.
1. `git add CHANGELOG.md`
1. `npm version -f [major|minor|patch]`
1. `git push --follow-tags`
1. Wait for the Github Actions to be complete. Download `artifact.zip`
1. Upload `ios-debug-<version>.vsix` to the Github Release as well as VS Code Marketplace.
