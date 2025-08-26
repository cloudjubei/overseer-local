# Monday.com Palette Reference (approximate)

Purpose
- Provide a practical reference for Monday.com-like colors to inform our design tokens. Values are approximations based on common usage seen in Monday’s UI (status column colors, brand accents). Replace with verified values if/when official brand tokens are available.

Brand
- Monday Blue (primary): #0073EA
- Alternate brand mid: #2B88F0, #0F7EEB (contextual steps)

Status and label colors (anchors)
- Done (green): #00C875
- Working on it (orange): #FDAB3D
- Stuck (red/pink): #E2445C
- On Hold (purple): #A25DDC
- Review (blue-ish): #579BFC
- Queued/None (grey): #C4C4C4

Additional accents observed in boards/labels
- Teal: #00D1D1
- Pink: #FF158A

Rationale for usage
- Bold chips: Monday uses highly saturated backgrounds with white or dark text depending on color family.
- Soft chips: Transparent tints + colored borders help maintain contrast in dense boards.

Contrast considerations
- Yellow/orange family generally requires dark text for AA; our tokens set working.fg to a dark tone.
- Greens and reds can use white text at sufficient depth; our tokens ensure FG/ BG pairs are explicitly defined.

Notes
- This document is not an official brand guide.
- Our DESIGN_TOKENS.md maps these anchors into full 50..900 scales and semantic tokens for implementation.
