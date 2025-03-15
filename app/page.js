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

async function getWeatherData(lat, lon) {
  const apiKey = process.env.NEXT_PUBLIC_OPEN_WEATHER_API_KEY
  const response = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
  )
  const data = await response.json()
  console.log(data)
  return data
}

export default function Home() { 
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [currentLatitude, setCurrentLatitude] = useState(null)
  const [currentLongitude, setCurrentLongitude] = useState(null)
  const [distance, setDistance] = useState(null)
  const [weatherData, setWeatherData] = useState(null)
  const accessToken = process.env.NEXT_PUBLIC_ACCESS_TOKEN
  const iconUrl = `http://openweathermap.org/img/wn/${weatherData?.weather[0].icon}.png`
  const localTime = weatherData
    ? new Date((weatherData.dt + weatherData.timezone) * 1000).toLocaleTimeString([], { timeStyle: 'short' })
    : null
  
    useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    const getSuggestions = async (searchText) => {
      if (!searchText || searchText === selectedLocation?.name) {
        setSuggestions([])
        // setQuery('')
        return
      }

      try {
        setIsLoading(true);
        const params = new URLSearchParams({
          access_token: accessToken,
          types: 'place,address,poi',
          autocomplete: 'true',
          limit: '4',
        })

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
    }, 300)

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

  useEffect(() => {
    const fetchWeatherData = async () => {
      if (selectedLocation) {
        const data = await getWeatherData(selectedLocation.coordinates[1], selectedLocation.coordinates[0])
        setWeatherData(data)
      }
    }
    fetchWeatherData()
  }, [selectedLocation])

  // jsx
  return (
    <div className="md:max-w-5xl w-dvw flex flex-col space-y-4  py-2 md:pt-[8rem] px-4 mx-auto">
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
      
      {distance && (
        <div className="my-4 relative mx-auto">
          <p>Approximately <span className="text-extrabold text-orange-500">{distance.toFixed(2)}</span> km</p>
        </div>
      )}

      <div className="flex space-x-2 rounded-md p-1 w-full">
        {selectedLocation && (
          <div className=" rounded-md border w-1/2">
            <div className=" border-b p-1.5 bg-slate-50/10">
              <p className="flex space-x-1">
                <span className="mx-1">📍</span>
                {addEllipsis(selectedLocation.name, 21)}</p>
            </div>
            <div className="p-2">
              <p>Latitude: {selectedLocation.coordinates[1]}</p>
              <p>Longitude: {selectedLocation.coordinates[0]}</p>
            </div>
          </div>
        )}
        {selectedLocation && weatherData && (
          <div className="border w-1/2 rounded-md" >
            <div className="border-b bg-slate-50/10 p-1.5"> 
              <p className="flex items-center"><span className="mx-2">
                <img src={iconUrl} className="h-[27px] w-[27px]"/></span>Current Weather</p>
            </div>
            <div className="p-2">
              <p>Local Time: {localTime}</p>
              <p>Weather: {weatherData.weather[0].description}</p>
              <p className="flex space-x-1">Temp: {weatherData.main.temp}°C</p>
              <p className="flex space-x-1">
                <span className="">💧</span>
                {weatherData.main.humidity}%<span></span></p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// utils
function addEllipsis(str, length) {
  return str.length > length ? str.substring(0, length) + "..." : str;
}

function getDistanceInMiles(lat1, lon1, lat2, lon2) {
  return getDistanceInKilometres(lat1, lon1, lat2, lon2) * 0.621371
}