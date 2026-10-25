# Paris reference photographs

20 real location photographs downloaded from Wikimedia Commons on 2026-10-25. Every image was inspected in `contact-sheet.jpg`; Gare de Lyon was also checked full size so its station facade and clock tower remain identifiable. The images are photographic references, not current live street views. Capture dates are retained in `places.json`.

`places.json` records location coordinates, local image path, source page, photographer, license, license URL, capture date and monument-preservation instructions. Coordinates identify the landmark, not a surveyed construction parcel.

Images were resized to a maximum edge of 1600 px and encoded as JPEG. Preserve each source attribution and applicable license in reference-photo and generated-result views. For a generated adaptation, retain the source credit, disclose the modification, and preserve the applicable share-alike terms where required. The source photograph license is separate from repository code licensing.

## Framing

Use uncropped/contain presentation or a user-controllable image fit for full landmark identification. Eiffel Tower and Sacré-Cœur source photographs are portrait images. The contact sheet uses cropped thumbnails, but source images contain the complete monument. Louvre shows the Cour Carrée facade, not the pyramid. Notre-Dame is seen from the Seine, not head-on. Grand Palais and Trocadéro are actual aerial views; preserve their perspective when generating. Pompidou shows the real renovation works photographed in July 2026.

## Reproduction

`python3 data/prepare_places.py` retrieves primary Wikimedia API metadata and downloads the source thumbnails. Requires Pillow. The checked-in `places.json` has a cleaned photographer credit for Trocadéro (Medium69 / William Crochot); Wikimedia's Artist field also contains a long permission notice.
