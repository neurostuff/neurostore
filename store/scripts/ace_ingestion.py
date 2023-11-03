from neurostore.ingest import load_ace_files, ace_ingestion_logic

coordinates_file = "/ace/no-pubmed-central-july-11-2023/coordinates.csv"
metadata_file = "/ace/no-pubmed-central-july-11-2023/metadata.csv"
text_file = "/ace/no-pubmed-central-july-11-2023/text.csv"

coordinates_df, metadata_df, text_df = load_ace_files(
    coordinates_file, metadata_file, text_file
)

ace_ingestion_logic(coordinates_df, metadata_df, text_df)
