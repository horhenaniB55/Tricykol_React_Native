import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone, timedelta
import uuid
import argparse
import random

# Initialize Firebase Admin SDK
cred = credentials.Certificate("service-account.json")
try:
    app = firebase_admin.initialize_app(cred, {
        'projectId': 'tricykol-b2296',
    })
except ValueError:
    # App already initialized
    app = firebase_admin.get_app()

# Initialize Firestore client
db = firestore.client()

def create_booking(passenger_id: str, pickup_lat: float, pickup_lng: float, dropoff_lat: float, dropoff_lng: float):
    """
    Create a booking from a passenger with specified pickup and dropoff locations.
    
    Args:
        passenger_id: The ID of the passenger creating the booking
        pickup_lat: Latitude of pickup location
        pickup_lng: Longitude of pickup location
        dropoff_lat: Latitude of dropoff location
        dropoff_lng: Longitude of dropoff location
    """
    try:
        # Verify passenger exists
        passenger_ref = db.collection('passengers').document(passenger_id)
        passenger = passenger_ref.get()
        
        if not passenger.exists:
            return {
                'success': False,
                'error': f'Passenger with ID {passenger_id} does not exist'
            }
        
        passenger_data = passenger.to_dict()
        
        # Generate a unique ID for the booking
        booking_id = str(uuid.uuid4())
        
        # Get current time
        now = datetime.now(timezone.utc)
        
        # Generate a geohash for the pickup location (simplified version)
        # In a real app, you'd use a proper geohash library
        geohash = f"{int(pickup_lat * 1000)}-{int(pickup_lng * 1000)}"
        
        # Create booking document
        booking_data = {
            'id': booking_id,
            'passengerId': passenger_id,
            'passengerName': passenger_data.get('name', 'Unknown Passenger'),
            'passengerPhone': passenger_data.get('phoneNumber', 'Unknown'),
            'pickupLocation': {
                'latitude': pickup_lat,
                'longitude': pickup_lng,
                'name': f"Pickup at {pickup_lat:.6f}, {pickup_lng:.6f}",
                'geohash': geohash
            },
            'dropoffLocation': {
                'latitude': dropoff_lat,
                'longitude': dropoff_lng,
                'name': f"Dropoff at {dropoff_lat:.6f}, {dropoff_lng:.6f}"
            },
            'status': 'pending',
            'dateTime': firestore.SERVER_TIMESTAMP,
            'estimatedDistance': random.randint(1000, 5000),  # Random distance in meters
            'estimatedDuration': random.randint(300, 1200),   # Random duration in seconds
            'estimatedFare': random.randint(25, 100),         # Random fare in pesos
            'driverId': None,
            'createdAt': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP
        }
        
        # Add guardian notification info if available
        if 'guardian' in passenger_data and passenger_data['guardian'].get('phoneNumber'):
            booking_data['guardianNotification'] = {
                'name': passenger_data['guardian'].get('name', 'Guardian'),
                'phoneNumber': passenger_data['guardian'].get('phoneNumber'),
                'relationship': passenger_data['guardian'].get('relationship', 'Guardian'),
                'notified': False
            }
        
        # Create booking document
        booking_ref = db.collection('bookings').document(booking_id)
        booking_ref.set(booking_data)
        print(f"Created booking with ID: {booking_id}")
        
        return {
            'success': True,
            'bookingId': booking_id,
            'message': 'Booking created successfully'
        }
        
    except Exception as e:
        print(f"Error creating booking: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

if __name__ == "__main__":
    # Set up argument parser
    parser = argparse.ArgumentParser(description='Create a booking from a passenger')
    parser.add_argument('--passenger', type=str, required=True, help='Passenger ID')
    parser.add_argument('--pickup_lat', type=float, required=True, help='Pickup latitude')
    parser.add_argument('--pickup_lng', type=float, required=True, help='Pickup longitude')
    parser.add_argument('--dropoff_lat', type=float, required=True, help='Dropoff latitude')
    parser.add_argument('--dropoff_lng', type=float, required=True, help='Dropoff longitude')
    
    args = parser.parse_args()
    
    # Create booking with the specified parameters
    result = create_booking(
        args.passenger,
        args.pickup_lat,
        args.pickup_lng,
        args.dropoff_lat,
        args.dropoff_lng
    )
    print(result) 