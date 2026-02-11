import pandas as pd
from sentence_transformers import SentenceTransformer
import numpy as np


cbc_df = pd.read_csv("backend/app/utils/cbc_values.csv")

# sanity check
print(cbc_df.head())
print(cbc_df.columns)

cbc_df = cbc_df.dropna(subset=["Value", "Description"])

def build_cbc_text(row):
    return (
        f"CBC competency: {row['Value']}. "
        f"Description: {row['Description']}."
    )

cbc_df["embedding_text"] = cbc_df.apply(build_cbc_text, axis=1)

model = SentenceTransformer("intfloat/e5-base-v2")

passages = [
    "passage: " + text
    for text in cbc_df["embedding_text"].tolist()
]

cbc_embeddings = model.encode(
    passages,
    batch_size=32,
    show_progress_bar=True,
    convert_to_numpy=True,
    normalize_embeddings=True  # IMPORTANT
)

np.save("cbc_embeddings.npy", cbc_embeddings)

cbc_df[["Value", "Description"]].to_csv(
    "cbc_metadata.csv",
    index=False
)

print("Embeddings shape:", cbc_embeddings.shape)
print("Sample vector norm:", np.linalg.norm(cbc_embeddings[0]))
