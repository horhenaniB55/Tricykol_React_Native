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

def calculate_fare(distance_meters: int, passenger_count: int):
    """
    Calculate fare based on distance and passenger count
    Base fare: 25 pesos for first 1 km
    Additional: 8 pesos per km after first 1 km
    Additional passenger: +10 pesos per additional passenger
    """
    # Convert to kilometers
    distance_km = distance_meters / 1000
    
    # Base calculation
    base_fare = 25  # First 1 km
    additional_km = max(0, distance_km - 1)  # Distance after first km
    additional_fare = round(additional_km * 8)  # 8 pesos per additional km
    
    # Additional passenger fare
    additional_passenger_fare = (passenger_count - 1) * 10  # 10 pesos per additional passenger
    
    total_fare = base_fare + additional_fare + additional_passenger_fare
    return round(total_fare)

def create_group_booking(passenger_id: str, pickup_lat: float, pickup_lng: float, 
                        dropoff_lat: float, dropoff_lng: float, passenger_count: int):
    """
    Create a booking for multiple passengers
    
    Args:
        passenger_id: The ID of the main passenger creating the booking
        pickup_lat: Latitude of pickup location
        pickup_lng: Longitude of pickup location
        dropoff_lat: Latitude of dropoff location
        dropoff_lng: Longitude of dropoff location
        passenger_count: Number of passengers (2 or 3)
    """
    try:
        # Validate passenger count
        if passenger_count not in [2, 3]:
            return {
                'success': False,
                'error': 'Passenger count must be 2 or 3'
            }

        # Verify passenger exists
        passenger_ref = db.collection('passengers').document(passenger_id)
        passenger = passenger_ref.get()
        
        if not passenger.exists:
            return {
                'success': False,
                'error': f'Passenger with ID {passenger_id} does not exist'
            }
        
        passenger_data = passenger.to_dict()
        
        # Generate booking ID
        booking_id = str(uuid.uuid4())
        
        # Generate simplified geohash
        geohash = f"{int(pickup_lat * 1000)}-{int(pickup_lng * 1000)}"
        
        # Generate random distance (1-5 km in meters)
        estimated_distance = random.randint(1000, 5000)
        
        # Calculate fare based on distance and passenger count
        estimated_fare = calculate_fare(estimated_distance, passenger_count)
        
        # Create booking document
        booking_data = {
            'id': booking_id,
            'passengerId': passenger_id,
            'passengerName': passenger_data.get('name', 'Unknown Passenger'),
            'passengerPhone': passenger_data.get('phoneNumber', 'Unknown'),
            'passengerCount': passenger_count,
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
            'estimatedDistance': estimated_distance,
            'estimatedDuration': random.randint(300, 1200),  # 5-20 minutes in seconds
            'estimatedFare': estimated_fare,
            'isGroupBooking': True,
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
        print(f"Created group booking with ID: {booking_id}")
        print(f"Passenger count: {passenger_count}")
        print(f"Estimated fare: ₱{estimated_fare}")
        
        return {
            'success': True,
            'bookingId': booking_id,
            'passengerCount': passenger_count,
            'estimatedFare': estimated_fare,
            'message': 'Group booking created successfully'
        }
        
    except Exception as e:
        print(f"Error creating group booking: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

if __name__ == "__main__":
    # Set up argument parser
    parser = argparse.ArgumentParser(description='Create a group booking from a passenger')
    parser.add_argument('--passenger', type=str, required=True, help='Passenger ID')
    parser.add_argument('--pickup_lat', type=float, required=True, help='Pickup latitude')
    parser.add_argument('--pickup_lng', type=float, required=True, help='Pickup longitude')
    parser.add_argument('--dropoff_lat', type=float, required=True, help='Dropoff latitude')
    parser.add_argument('--dropoff_lng', type=float, required=True, help='Dropoff longitude')
    parser.add_argument('--passengers', type=int, required=True, choices=[2, 3], 
                       help='Number of passengers (2 or 3)')
    
    args = parser.parse_args()
    
    # Create booking with the specified parameters
    result = create_group_booking(
        args.passenger,
        args.pickup_lat,
        args.pickup_lng,
        args.dropoff_lat,
        args.dropoff_lng,
        args.passengers
    )
    print(result) 