# Christmas snowfall

The public website snowfall is implemented by `js/snowfall.js` and `css/snowfall.css`. It is loaded only by `index.html` and `offers.html`. Admin, client, portal, printable quotation, and exported document pages do not load it.

## Disable it after Christmas

Open `js/snowfall.js` and change the central configuration value:

```js
enabled: false,
```

With the feature disabled, the script creates no canvas or animation loop. If an active effect is stopped through `window.ZyntraSnowfall.destroy()`, its canvas, animation frame, observers, and event listeners are removed.

## Remove it completely

1. Remove `<link rel="stylesheet" href="css/snowfall.css">` from `index.html` and `offers.html`.
2. Remove `<script src="js/snowfall.js"></script>` from `index.html` and `offers.html`.
3. Delete `css/snowfall.css` and `js/snowfall.js`.
4. Delete `tests/snowfall.test.js` and `tests/snowfall-browser-check.js` if the feature is permanently removed.

No other website files, pricing logic, quotation logic, or account screens depend on the snowfall module.
