from PIL import Image
import os

src = r"D:\Nexon\P5_President\Resource\PlayStation 4 - Persona 5 Royal - Thieves Den - Tycoon Cards.png"
out_dir = r"D:\Nexon\P5_President\Resource\CardImage"

img = Image.open(src)
W, H = img.size
COLS, ROWS = 12, 5
cw = W / COLS
ch = H / ROWS
print(f"Image size: {W}x{H}, Cell: {cw:.1f}x{ch:.1f}")

def crop(ci, ri):
    x1 = round(ci * cw)
    y1 = round(ri * ch)
    x2 = round((ci + 1) * cw)
    y2 = round((ri + 1) * ch)
    return img.crop((x1, y1, x2, y2))

suits = ["C", "D", "H", "S"]
ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q"]

for r, suit in enumerate(suits):
    for c, rank in enumerate(ranks):
        name = f"{rank}{suit}.png"
        crop(c, r).save(os.path.join(out_dir, name))
        print(f"Saved {name}")

row5 = [
    (0, "Joker.png"),
    (2, "Card-back.png"),
    (3, "KC.png"),
    (4, "KD.png"),
    (5, "KH.png"),
    (6, "KS.png"),
]
for col, name in row5:
    crop(col, 4).save(os.path.join(out_dir, name))
    print(f"Saved {name}")

print("Done!")
