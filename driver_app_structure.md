React native with Expo, JavaScript, Classic routing/router, Firebase(React native firebase sdk), Zustand, Google Maps

Models:

- Authentication
  - for authentication we are using third party SMS gateway for sending OTP
  - we are implementing passwordless authentication
  - combine the third party SMS gateway with logic to verify OTP and generate a custom firebase token for authentication
        - using semaphore api(check usage at the bottom of the page) sends OTP to the driver's phone number
        - the OTP will be used to verify the driver's phone number
        - the custom firebase token will be used to authenticate the driver

  - persistent user session
    

- Admins


- Driver
    Driver profile
        - name
        - profile picture
        - email(optional)
        - sex
        - date of birth
        - phone number
        - plate number 
        - license number
        - permit to operate document(pdf, jpg, png) - driver will upload document online
        - is_verified(boolean)
        - permit verified(boolean)
        - status(online, offline)
        - for vehicle one type of vehicle only(Tricycle)- do not include this

- Passenger
    Passenger profile
        - name
        - email (optional)
        - phone numer
        - sex
        - date of birth
        - guardian/parent/contact person (optional)
             - name
             - relationship
             - phone number
             - this will be use to send sms alert to parent/guardian after the driver confirms the pickup 

- Driver requests
  - booking
  - status(pending, accepted, rejected)
  - driver will send request to the passenger's booking
  - passenger will accept the request

- Bookings
  - pickup location
  - drop off location
  - date and time
  - schedule(optional)
  - status(pending, in progress, completed)
  - driver 


- Payments
    - passengers main payment method for complete trip is only cash

- Top-up request  

- Transactions
    - complete trip payment
    - driver top up wallet

- Wallets 
    - for drivers
    - automatic creation of wallet for drivers after complete registration


Login and Registration Process


- Driver
  - Login 
   - input number
   - get otp
   - input otp
   - verify otp
   - check driver from database
   - if driver exist go to main screen
   - if driver does not exist informational message "Phone number not yet registered"

  - Register(Redirect to website)
    - input number
    - get otp
    - input otp
    - verify otp
    - check driver from database
    - if driver exist informational message "Phone number already registered"
    - if driver does not exist go to the next steps
    - input name
    - input profile picture
    - input email
    - input sex
    - input date of birth
    - input license number
    - input plate number
    - upload permit to operate document

Trip Process


 Driver account creation

 Admin verifies the driver account

 Passenger account creation
 Driver login
 Driver wallet top-up(this will top up the driver credit wallet balance)
 Passenger login
 Driver status update

- Passenger creates booking
- Driver gets the nearby bookings(if driver is online) within 700 meter radius
- Driver send request to the booking of the passenger 
- Passenger accept the request from the driver

- Driver will have an action button, updates the trip status on the way to pickup location 
- Driver arrived to pickup location, automatically update the trip status to 'Arrived at pickup location'
- Automatice notif to the passenger that the driver has arrived to the pickup location
- Driver will update the trip to picked up using action button if the passenger is already on the vehicle
- Sms alert will sends the alert to the contact person('guardian' etc..) - automatic after the status is updated to picked up

- Driver will update the trip to in progress/start using action button if the passenger is already on the vehicle

- if passenger changes the dropoff location while trip is in progress
   - Driver update dropoff location
   - automatic fee, routes, distance, duration will be updated

- Trip in progress
    - realtime location
    - realtime map view

- Arrive at dropoff location
    - automatically check the location 
    - if both driver and passenger's location is arrived to the dropoff location
    - confirmation will display(driver screen)
    - Driver will confirm the trip 
    - if the passenger wants to dropoff even if they are not yet arrived to the dropoff location(300m to the actual dropoff location)
    - Driver will use the action button to confirm the trip
- Trip completed(passenger will always pay cash, system fee will be deducted to the driver credit wallet balnce)

- Done successfull trip


- Payments and Transactions
  - Wallets
    - Driver will have wallet for credit balance
    - Free 300 pesos credit(verified driver)
    - A minimum of 300 pesos top up
    - Top up physical outlet(Tricykol Paniqui Outlet)
  - Payments
    - Complete trip payment(cash for passenger)

    - Top up wallet process
      - Driver will go to wallet page
      - Driver will press 'top up' button
      - Driver will input the amount
      - Driver will choose the payment method
      - top up details will be displayed
      - Driver will confirm the top up
      - Transaction details will be displayed
         - Transaction ID
         - Amount
         - Reference number
         - Payment method
         - Date and time created(Timezone Manila PH time)
         - Expiry date (12 hours)
      - Request top up status 'pending'
      - Driver will go to the outlet
      - Driver will show the transaction details to the cashier
      - Admin will verify the transaction
      - Admin will update the driver wallet balance
      - The top up status will be updated to 'completed'


- Fees and Fare
    - Base fare for passenger: 25 pesos for first 1 km
    - System fee: 12%
    - 8 pesos for each km after the first 1 km


Admin

- Admin login

 - username(add default admin account)
 - password
 - admin account creation
   - username
   - email
   - password
   - confirm password

- Admin dashboard
   - can update driver profile
   - not able to view driver's credit wallet balance
   - can update/add driver credit wallet balance if driver request to top up and show transaction details
   - verifies driver account
   - verifies driver's permit to operate document
   - able to view driver's uploded permit to operate document


Services
 - SMS gateway
 - Firebase cloud firestore for database and realtime updates
 - Firebase storage
 - Location services
 - automatic fare, route and distance calculation
 - Geocoding
 - Geofencing
 - Geolocation

Map Features
 - realtime location
 - realtime map view
 - Google Maps API
 - Directions from Google maps
 - Places api new(search places) - google
 - Routes api - google
 - Distance Matrix api - google
    

OTP Authentication

- SMS gateway
 - third party SMS gateway for sending OTP
 - Semaphore
 - Semaphore api and firebase custom token authentication
 - Create sendOtp Function
   Purpose: Generate OTP, store it, and send via Semaphore. 
 - Create verifyOtp Function
   Purpose: Verify OTP and generate Firebase custom token. 



semaphore api usage:

Semaphore also provides a simple and easy interface for generating OTP on the fly. Messages sent through this endpoint are routed to a SMS route dedicated to OTP traffic. This means your OTP traffic should still arrive even if telcos are experiencing high volumes of SMS.This service is 2 credits per 160 character SMS.

Note: This endpoint is not rate limited

https://api.semaphore.co/api/v4/otp

This endpoint accepts the exact same payload as a regular message but you can specify where in the message to insert the OTP code by using the placeholder "{otp}"

If you would like to specify your own OTP code and skip the auto-generated one, just pass a "code" parameter with your call.

For instance using the message: "Your One Time Password is: {otp}. Please use it within 5 minutes." will return the message "Your One Time Password is: XXXXXX. Please use it within 5 minutes."

The response is the same as a regular message but an additional code parameter is passed which indicates the auto-generated OTP or the OTP code you passed in the "otp" parameter:

            
[
    {
        "message_id": 12345,
        "user_id": 54321,
        "user": "timmy@toolbox.com",
        "account_id": 987654,
        "account": "My Account",
        "recipient": "639998887777",
        "message": "Your OTP code is now 332200. Please use it quickly!",
        "code": 332200,
        "sender_name": "MySenderName",
        "network": "Globe",
        "status": "Pending",
        "type": "Single",
        "source": "Api",
        "created_at": "2020-01-01 01:01:01",
        "updated_at": "2020-01-01 01:01:01",
    }
]
            
            

If you do not provide the placeholder, the OTP code will be appended to your original message. For instance if you send the message "Thanks for registering" the message will have the OTP appended to the end as "Thanks for registering. Your One Time Password is XXXXXX"

curl --data "apikey=YOUR_API_KEY&number=MOBILE_NUMBER&message=Thanks for registering. Your OTP Code is {otp}." https://semaphore.co/api/v4/otp


