from app.db.vector_store import VectorStore
from app.services.embedder.e5_embedder import E5Embedder


def main():
    course_id = "cs101"
    collection = VectorStore.course_collection_name(course_id)

    vs = VectorStore()
    emb = E5Embedder()

    q = "What does the squeaking door represent, and how does he try to reach it without being seen?"
    qvec = emb.embed_query(q)

    results = vs.query_embeddings(
        collection=collection,
        query_embeddings=[qvec],
        n_results=5,
        where=None,  # or filter e.g. {"uploader_user_id": "lecturer_001"}
    )

    print("\n--- Query Results (top 5) ---")
    # chroma returns lists
    docs = results.get("documents", [[]])[0]
    metas = results.get("metadatas", [[]])[0]
    dists = results.get("distances", [[]])[0]

    for i, (doc, md, dist) in enumerate(zip(docs, metas, dists), start=1):
        print(f"\n#{i} distance={dist}")
        print("meta:", md)
        print("text:", (doc[:300] + "...") if doc and len(doc) > 300 else doc)


if __name__ == "__main__":
    main()
