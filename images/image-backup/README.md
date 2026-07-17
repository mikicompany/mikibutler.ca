# Image backup

Local backups of the ArtStation images used on the site — in case ArtStation
ever goes away. These files are **not linked** anywhere; the site still loads
images from ArtStation URLs. This is purely a safety copy.

## How to populate it
Run from the repo root (Git Bash on Windows, or Terminal on macOS/Linux):

    bash tools/backup-artstation-images.sh

It downloads every image listed in `tools/artstation-image-urls.txt` into this
folder, skipping any already present. Then commit the folder.
