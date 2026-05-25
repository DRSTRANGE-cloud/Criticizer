RATING_OPTIONS = [
    {"stars": 1, "label": "Waste of Time", "color": "red"},
    {"stars": 2, "label": "Check that Out Once", "color": "yellow"},
    {"stars": 3, "label": "Kinda Liked It", "color": "yellow"},
    {"stars": 4, "label": "It’s Peak", "color": "green"},
    {"stars": 5, "label": "Absolute Cinema", "color": "purple"},
]

RATING_LABELS = [r["label"] for r in RATING_OPTIONS]


def empty_distribution() -> dict[str, int]:
    return {label: 0 for label in RATING_LABELS}

