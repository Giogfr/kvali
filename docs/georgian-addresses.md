# Georgian addresses

OpenStreetMap address data in Georgia is inconsistent. A single word can mix
Mtavruli (the uppercase alphabet) with Mkhedruli (the regular alphabet), the
`addr:city` tag is often missing, postcodes are rare, and some records name a
city that does not match their coordinates.

`src/lib/georgianAddress.ts` cleans this data without inventing anything.

## Text normalization

- Mtavruli code points (U+1C90 to U+1CBF) are converted to their Mkhedruli
  equivalents (U+10D0 to U+10FF).
- Non-breaking spaces become normal spaces.
- Typographic quotes become `"`, en/em dashes become `-`.
- Runs of whitespace collapse and the result is trimmed.

Latin text is left alone.

## Postcodes

`extractPostcodes()` finds four-digit numbers in the range 0100 to 9999,
removes duplicates, and keeps their original order. Five-digit numbers and
values below 0100 are ignored.

A postcode is only displayed if it was present in the source text. The
normalizer never fills in a missing postcode.

## City checks

The module knows generous bounding boxes for fifteen towns: Tbilisi, Batumi,
Kutaisi, Zugdidi, Rustavi, Gori, Poti, Telavi, Mtskheta, Samtredia, Kobuleti,
Zestafoni, Marneuli, Akhaltsikhe and Sighnaghi. The boxes are wider than the
municipal boundaries, so a suburb is not treated as an error.

`normalizeAddress()` returns the normalized text, the postcode list, the
matched city, and a `coordinateMismatch` flag. A record is flagged only when it
names a known city and its coordinates fall outside that city's box. The app
uses this to rank suspicious search results last instead of silently rewriting
the address.

## Tests

```sh
bun run test:address
```

The tests cover Mtavruli conversion, punctuation, postcode ranges, English and
Georgian city names, matching and mismatching coordinates, and the missing
coordinates case.
