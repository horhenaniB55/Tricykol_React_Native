import requests
import os
import argparse
import uuid
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get Mapbox access token
MAPBOX_ACCESS_TOKEN = os.getenv("MAPBOX_ACCESS_TOKEN")

def search_mapbox(query: str, language: str = "en", proximity: str = None, session_token: str = None):
    """
    Searches for places using the Mapbox Searchbox API and extracts location data.

    Args:
        query: The search query (e.g., "St. Paul Paniqui").
        language: The language for the search results (default: "en").
        proximity: Coordinates for prioritizing results (e.g., "-73.990593,40.740121").
        session_token: A unique session token for billing purposes.

    Returns:
        A list of dictionaries, each containing data for a suggested place, or None if an error occurs.
    """
    base_url = "https://api.mapbox.com/search/searchbox/v1/suggest"
    url = f"{base_url}?q={query}&language={language}&access_token={MAPBOX_ACCESS_TOKEN}"

    if proximity:
        url += f"&proximity={proximity}"
    if session_token:
        url += f"&session_token={session_token}"


    try:
        response = requests.get(url)
        response.raise_for_status()  # Raise an exception for bad status codes
        data = response.json()

        places = []
        for suggestion in data.get("suggestions", []):
            place_data = {
                "name": suggestion.get("name"),
                "full_address": suggestion.get("full_address"),
                "place_formatted": suggestion.get("place_formatted"),
                "mapbox_id": suggestion.get("mapbox_id")
            }
            places.append(place_data)
        return places

    except requests.exceptions.RequestException as e:
        print(f"Error during API request: {e}")
        return None


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Search for places using Mapbox Searchbox API.")
    parser.add_argument("--query", type=str, required=True, help="The search query.")
    parser.add_argument("--language", type=str, default="en", help="Language for results (default: en).")
    parser.add_argument("--proximity", type=str, help="Proximity coordinates (e.g., -73.990593,40.740121).")
    parser.add_argument("--session_token", type=str, help="Session token for billing.")

    args = parser.parse_args()

    # Generate a session token if not provided
    session_token = args.session_token or str(uuid.uuid4())

    results = search_mapbox(args.query, args.language, args.proximity, session_token)

    if results:
        print(f"Search results for '{args.query}':")
        for place in results:
            print(f"  Name: {place.get('name')}")
            print(f"  Full Address: {place.get('full_address')}")
            print(f"  Place Formatted: {place.get('place_formatted')}")
            print(f"  Mapbox ID: {place.get('mapbox_id')}")
            print("-" * 20)
    else:
        print(f"No results found for '{args.query}' or an error occurred.")
