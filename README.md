// README.md

For a demo, see <http://pook.io/>.

An HTML5 photobook editor, a 2012/2013 project.

## Motivation ##

I am the family librarian, and every year I create our photo yearbook. It is lovely, but making it is not. There are dozens of editors out there. They all fail __me__ in a big way.

Before digital, I used to make photo albums by hand, pasting 4x6s into an album. It was fun, pleasant way to spend a couple of nights, writing cute things in the margins...

I was excited about digital. I had a vision of making my books with software. My photos could be different sizes, It'd have infinite templates, because it is the internet. I could work on the book year-round, while I am standing in a line... Just like doing it manually, but better!

To my surprise, the imagined editor did not happen. The failures were:

- easy UI, limited creative control. Fixed templates, without much control over how you place your photos. I disliked this for its "powerpoint" feel. I like my books messy, alive.

- bad UI. The charms of cross-platform java/flash apps. Mobile? NO!

- social, what social? No collaboration, no user-contributed template libraries.

- quality: most sites do not offer high-quality books. I was used to quality of my 4x6 prints. This quality is now known as "super-premium", and is offered by very few: Adorama, SmileBooks, Mixbook.

When I started, HTML5 was happening, lots of new toys to play with.

## Original Goals ##

- HTML5 UI with full creative control. Fast, could create book while photos upload.
- Touch native
- Works on browser, tablet, _phone_
- Collaborative editing Google Docs style
- Offline support
- User can define own templates _(no UI for this)_
- _wide variety of templates_
- HTML as book's native format, for WYSIWYG, and ability to edit 20 years from now
- _import photos from FB/Google/etc
- _missed goals_

## Current status ##

The proof of concept is complete. The next stage would be more serious, hiring designers, and hooking up to a printer. This would take about $100K worth of work, and <6 months. Marketing is a big unknown. I think it could be done by catering to underserved scrapbook designer community.

It's a no-go. I am not that crazy about photobooks. SmileBooks editor is almost good enough. I'd love it if this would serve as an inspiration to someone already in the business. I'd be happy to help.

## Interesting technical bits ##

There were several interesting problems

Could books be native HTML? The answer is yes. Chrome generates reasonable PDF from HTML. I've extended it so I can generate these PDFs programatically on a server.

Collaborative editing: my book is represented as a bag'o'json. I implemented collaborative editing with json diff/patch. Clients send diffs to server, and receive patches. With json structured just right, this gives me great flexibility in designing book's data structures, and minimizes conflicts. If I was redoing it today, I might play with Backbone/Ember/Firebase instead.

Page template design: Templates should be flexible. I hated how adding text required choosing a new template in iPhoto. Templates should automatically accomodate text, additional photos. In pook.io, templates are a family of related designs. Adding text/photos picks the correct design out of a family. There are many edge cases (what happens when user resizes photos, adds new artwork, etc), and not all have been covered yet. But I love it, it helps make book editing fun, you are not always thinking about the templates, you are just adding text, moving photos, flow!

Themes: book can have arbitrary number of themes. Users can create themes (UI is not there, but architecture is).

And, all of this has been wrapped inside a fast HTML UI, I love the page flips in full-screen mode on desktop.
