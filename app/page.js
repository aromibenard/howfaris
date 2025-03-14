'use client'

import { useEffect, useState } from "react"

// prompts user to allow location services
function getCurrentCoordinates() {
  return new Promise((resolve, reject) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const currentLatitude = position.coords.latitude
          const currentLongitude = position.coords.longitude
          resolve({ currentLatitude, currentLongitude })
        },
        (error) => {
          reject(error)
        }
      )
    } else {
      reject(new Error("Geolocation is not supported by this browser."))
    }
  })
}

// Haversine Formula
function getDistanceInKilometres(lat1, lon1, lat2, lon2) {
  // converting degrees to radian
  const toRadians = (degree) => degree * (Math.PI / 180)
  const R = 6378 // earth radius in km
  const φ1 = toRadians(lat1)
  const φ2 = toRadians(lat2)
  const Δφ = toRadians(lat2 - lat1)
  const Δλ = toRadians(lon2 - lon1)

  // Haversine formula
  const a = 
    Math.sin(Δφ/2) * Math.sin(Δφ/2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ/2) * Math.sin(Δλ/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c; // Distance in kilometers
}

export default function Home() { 
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [currentLatitude, setCurrentLatitude] = useState(null)
  const [currentLongitude, setCurrentLongitude] = useState(null)
  const [distance, setDistance] = useState(null)

  const accessToken = process.env.NEXT_PUBLIC_ACCESS_TOKEN

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const getSuggestions = async (searchText) => {
      if (!searchText || searchText === selectedLocation?.name) {
        setSuggestions([]);
        return;
      }

      try {
        setIsLoading(true);
        const params = new URLSearchParams({
          access_token: accessToken,
          types: 'place,address,poi',
          autocomplete: 'true',
          limit: '4',
        });

        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            searchText
          )}.json?${params}`,
          { signal }
        );

        if (!response.ok) throw new Error('Failed to fetch suggestions');
        
        const data = await response.json();
        setSuggestions(data.features);
      } catch (error) {
        if (!signal.aborted) {
          console.error('Geocoding error:', error);
        }
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    const timer = setTimeout(() => {
      if (query.length >= 2) {
        getSuggestions(query)
      } else {
        setSuggestions([])
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    }
  }, [query, selectedLocation])

  const handleSelect = (feature) => {
    setQuery(feature.place_name);
    setSelectedLocation({
      name: feature.place_name,
      coordinates: feature.geometry.coordinates,
    })
    setSuggestions([])
  }

  useEffect(() => {
    const fetchCurrentCoordinates = async () => {
      const {currentLatitude, currentLongitude } = await getCurrentCoordinates()
      setCurrentLongitude(currentLongitude)
      setCurrentLatitude(currentLatitude)
    }
    fetchCurrentCoordinates()
  },[])

  useEffect(() => {
    const getDistance = () => {
      if (selectedLocation && currentLatitude && currentLatitude) {
        const distance = getDistanceInKilometres(
          currentLatitude, currentLongitude,
          selectedLocation.coordinates[1], selectedLocation.coordinates[0]
        )
        setDistance(distance)
      }
    }
    getDistance()
  },[selectedLocation, currentLatitude, currentLongitude])

  return (
    <div className="md:max-w-5xl w-dvw flex flex-col space-y-3  pt-4 md:pt-[8rem]">
      <h1 className="relative mx-auto">
        How far is {selectedLocation ? selectedLocation.name : query}
      </h1>
      <div className="relative max-w-3/4 mx-auto">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search location..."
          className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {isLoading && (
          <div className="p-2 text-gray-500">Searching...</div>
        )}

        {!selectedLocation && suggestions.length > 0 && (
          <ul className="absolute w-full mt-1 border rounded-md shadow-lg">
            {suggestions.map((feature) => (
              <li
                key={feature.id}
                onClick={() => handleSelect(feature)}
                className="p-2 cursor-pointer hover:bg-slate-50/10 transition-colors"
              >
                {feature.place_name}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex space-x-2">
        {selectedLocation && (
          <div className="mt-4 p-4  rounded-md">
            <h3 className="font-semibold mb-2">Selected Location:</h3>
            <p className="text-sm">
              <span className="font-medium">Name:</span> {selectedLocation.name}
            </p>
            <p className="text-sm">
              <span className="font-medium">Latitude:</span> {selectedLocation.coordinates[1]}
            </p>
            <p className="text-sm">
              <span className="font-medium">Longitude:</span> {selectedLocation.coordinates[0]}
            </p>
          </div>
        )}
        <div className="p-1">
          🙂
        </div>
      </div>
      {distance && (
        <div>
          {`Approximately ${distance.toFixed(2)} km😗`}
        </div>
      )}
    </div>
  );
}