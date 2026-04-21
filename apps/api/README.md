# Taalwiz API

## Content File Uploads

### Articles

The API supports uploading content article files in markdown format. The content files are expected to be in the format of `group.name.md`, where `group` is a string that represents the group of the article, and `name` is a string that represents the name of the article. For example, `english.hello-world.md` would be an article in the `english` group with the name `hello-world`.

### Dictionary Files

The API also supports uploading dictionary files in JSON format. The dictionary files are expected to be in the format of `group.<letter>.json`, where `group` is a string that represents the group of the dictionary, and `<letter>` is a letter a-z that represents the section of the dictionary for that letter. For example, `english.d.json` would be a dictionary in the `english` group for the letter `d`.
