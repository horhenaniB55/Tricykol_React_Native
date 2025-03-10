### centralized server-side location tracking system (Firebase Firestore) 


- use a **centralized server-side location tracking system** (Firebase) for the current project. This approach simplifies client-side logic and centralizes data management, but it requires careful design to balance efficiency, scalability, and cost. Here's how to implement it:

---

### **Architecture Overview**
```
[Driver's App] → (Background Location Updates) → [Firestore/Server] → (Realtime Updates)
```

- get the current location stored from the async storage
- push the current location of the driver to firestore.('drivers' collection)
- update the driver location in realtime in firestore only if driver location changes 5m('drivers' collection)
- add a TTL 
- this will update the driver location in realtime in firestore.('drivers' collection)


---

### **Why Centralized Server-Side Tracking Works**
1. **Simpler Client Code**: Clients only push location updates to the server; the server handles distribution.  
2. **Unified Data Source**: All location data is stored and managed in one place (e.g., Firestore).  
3. **Easier Scaling**: Features like ride history, analytics, and geofencing are simpler to implement server-side.  

---


#### **4. Handle Offline/Errors Gracefully**
- **Firestore Offline Persistence**: Enable offline data caching for passengers/drivers.  
- **Retry Logic**: If a location push fails, cache it locally and retry later.  
- **Status Checks**: 

---


2. **Batch Updates**  
   Cache multiple location changes locally and send them in bulk periodically.  

3. **TTL (Time-to-Live) for Old Data**  
   Automatically delete stale locations using Firestore TTL policies.  

4. **Reduce Listener Overhead**  
   Passengers should only listen to drivers they’re actively tracking (not the entire drivers collection).  

---



- Use `distanceInterval` and `timeInterval` to throttle updates.  
- Enable Firestore’s offline persistence.  
- Restrict location listeners to active rides only.  

## FIRST IMPLEMENTATION


- we do not need the retry get location logic. We need to get the location once and store it in async storage.
- if location coordinates changes 5m then save it in async storage and clean up the saved location coordinates from previous.
- if location coordinates does not change 5m then do not save it in async storage.
- if driver status is offline do not clean up the last saved location coordinates from async storage.
- we should make it simple and clean.

Key features of this implementation:
Only updates location when distance changes by 5m or more
Properly manages AsyncStorage (removes old location before storing new one)
Keeps last known location in AsyncStorage even when driver goes offline
Clean lifecycle management (starts/stops based on driver status)
No retry logic or periodic monitoring
Simple and focused implementation
The flow is now:
Initialize location services once on mount
Start tracking when driver goes online
Only update when location changes by 5m
Stop tracking when driver goes offline
5. Keep last known location in storage
Clean up properly on unmount

For the location service setting listener:
Make sure we have a proper listener if location is enabled or disabled and has permission or no permission
Display a modal showing location is disabled or no permission or both
This is not monitoring that periodically run a checking if location is enabled or disabled and has permission or no permission, this should be listener(useEffect or async)
The goal here is to simplify the location service and make it clean and simple.


