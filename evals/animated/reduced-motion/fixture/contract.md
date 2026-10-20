# Frame selection contract

`selectFrame(progress, count, options = {})` returns an index in `[0,count-1]`.
An invalid count (not a positive integer) returns null. A reduced-motion
preference (`reducedMotion === true`) or an explicitly hidden animation
(`visible === false`) returns frame zero. A nonfinite or nonnumeric progress
uses zero; otherwise clamp progress to `[0,1]`, then floor `progress*(count-1)`.
Missing frames must stay a static placeholder; no nonexistent asset is used.
