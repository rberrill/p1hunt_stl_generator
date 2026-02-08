# PNG to 2D Vector Converter

Simple static webpage app that:
- uploads a PNG,
- quantizes to a selected color depth,
- lets you click connected regions to assign them to an output color,
- exports a vector SVG.

## Run locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.


## Quality tips

- Increase **Max working dimension** to keep more source detail before quantization.
- Increase **SVG smoothing passes** (0-3) to round jagged stair-step edges in the exported vector.
