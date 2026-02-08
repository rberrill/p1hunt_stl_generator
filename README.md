# PNG to 2D Vector Converter

Simple static webpage app that:
- uploads a PNG,
- quantizes to a selected color depth,
- lets you click connected regions to assign them to an output color,
- exports a vector SVG with configurable DPI (minimum 72 DPI).

## Run locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.


Notes:
- Processing now uses the full uploaded PNG resolution (no automatic downscaling).
- Set Export DPI to control physical output size metadata in the SVG.
