import { useState, useRef, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import UserHistory from './UserHistory'

export default function Dashboard({ session, profile }) {
  const [gyms, setGyms] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [location, setLocation] = useState(null)
  const [stream, setStream] = useState(null)
  const [checkingIn, setCheckingIn] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [selectedBuddy, setSelectedBuddy] = useState('')
  const [viewingUser, setViewingUser] = useState(null)
  const [replacedDay, setReplacedDay] = useState('')
  const [weeklyCheckins, setWeeklyCheckins] = useState([])
  const [comodinCheckins, setComodinCheckins] = useState([])
  const [replacedCheckins, setReplacedCheckins] = useState([])
  const [isResetting, setIsResetting] = useState(false)
  const [resetStatus, setResetStatus] = useState({ readyCount: 0, totalCount: 0, isReady: false })
  const videoRef = useRef(null)

  // Detectar si hoy es un dia programado (1=Lunes, 7=Domingo)
  const todayDateObj = new Date()
  const today = todayDateObj.getDay() || 7 
  const isTargetDay = profile?.target_days?.includes(today)
  
  // Es exactamente el último día del mes
  const isLastDayOfMonth = todayDateObj.getDate() === new Date(todayDateObj.getFullYear(), todayDateObj.getMonth() + 1, 0).getDate()

  const resetMyMonth = async () => {
    if (!window.confirm('¿Estás listo para finalizar el mes? Tu progreso se borrará cuando todos los usuarios lo confirmen.')) return
    
    setIsResetting(true)
    setError('')
    try {
      // 1. Marcar al usuario logueado como "listo para reset"
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ ready_to_reset: true })
        .eq('id', session.user.id)

      if (updateError) throw updateError

      // 2. Obtener de nuevo todos los status para ver si ya están todos listos
      const { data: profilesData } = await supabase.from('profiles').select('id, ready_to_reset')
      const allProfiles = profilesData || []
      const totalCount = allProfiles.length
      const readyCount = allProfiles.filter(p => p.ready_to_reset).length
      
      setResetStatus({
        totalCount,
        readyCount,
        isReady: true
      })

      // 3. Si no todos han confirmado, mostrar mensaje de que se espera a los demás
      if (readyCount < totalCount) {
        setSuccessMsg(`Faltan (${readyCount}/${totalCount}) para borrar todo.`)
        return
      }

      // == SI LLEGAMOS AQUI ES PORQUE TODOS ESTAN LISTOS ==
      setSuccessMsg('¡Todos han confirmado! Reiniciando datos generales...')

      // 4. Borrar TODO de 'check_ins' y fotos del 'storage' globalmente
      const { data: allCheckins } = await supabase
        .from('check_ins')
        .select('photo_url')

      if (allCheckins && allCheckins.length > 0) {
        const filesToDelete = allCheckins
          .map(c => c.photo_url)
          .filter(Boolean)
          .map(url => {
            const urlParts = url.split('/')
            return urlParts[urlParts.length - 1]
          })

        if (filesToDelete.length > 0) {
          await supabase.storage.from('gymsito').remove(filesToDelete)
        }
      }

      // Borrar registros en bbdd
      await supabase.from('check_ins').delete().neq('user_id', '00000000-0000-0000-0000-000000000000')

      // 5. Restablecer 'ready_to_reset' a false
      await supabase
        .from('profiles')
        .update({ ready_to_reset: false })
        .neq('id', '00000000-0000-0000-0000-000000000000')

      setSuccessMsg('¡El mes ha sido reiniciado con éxito para todos!')
      
      // Actualizar datos
      fetchLeaderboard()
      fetchWeeklyCheckins()
      fetchResetStatus()
    } catch (err) {
      console.error(err)
      setError('Hubo un error al confirmar tu reinicio mensual.')
    } finally {
      setIsResetting(false)
    }
  }

  const fetchWeeklyCheckins = async () => {
    const now = new Date()
    const currentDayOfWeek = now.getDay() || 7
    // Calcular el lunes de esta semana
    const monday = new Date(now)
    monday.setDate(now.getDate() - currentDayOfWeek + 1)
    monday.setHours(0, 0, 0, 0)

    const { data } = await supabase
      .from('check_ins')
      .select('created_at, is_comodin, replaced_day')
      .eq('user_id', session.user.id)
      .gte('created_at', monday.toISOString())

    if (data) {
      // Guardamos IDs de los días (1-7) en los que asistió normalmente
      const attendedNormalDays = data
        .filter(c => !c.is_comodin)
        .map(c => new Date(c.created_at).getDay() || 7)
      
      // Guardamos IDs de los días en los que usó comodín
      const attendedComodinDays = data
        .filter(c => c.is_comodin)
        .map(c => new Date(c.created_at).getDay() || 7)

      // Guardamos IDs de los días que fueron salvados por comodin
      const replacedTargetDays = data
        .filter(c => c.replaced_day)
        .map(c => c.replaced_day)

      setWeeklyCheckins(attendedNormalDays)
      setComodinCheckins(attendedComodinDays)
      setReplacedCheckins(replacedTargetDays)
    }
  }

  const fetchGyms = async () => {
    const { data } = await supabase.from('gyms').select('*')
    if (data) setGyms(data)
  }

  const fetchLeaderboard = async () => {
    const { data } = await supabase.from('leaderboard').select('*')
    if (data) setLeaderboard(data)
  }

  const fetchResetStatus = async () => {
    const { data } = await supabase.from('profiles').select('id, ready_to_reset')
    if (data) {
      const totalCount = data.length
      const readyCount = data.filter(p => p.ready_to_reset).length
      
      const myProfile = data.find(p => p.id === session.user.id)
      const isReady = myProfile?.ready_to_reset || false

      setResetStatus({
        totalCount,
        readyCount,
        isReady
      })
    }
  }

  const getLocation = () => {
    setError('')
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          })
        },
        () => {
          setError('No pudimos acceder a tu ubicación. Es necesaria para el registro.')
        }
      )
    } else {
      setError('Tu navegador no soporta geolocalización.')
    }
  }

  // Calcular distancia usando fórmula de Haversine
  const getDistanceFromLatLonInMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371000 // Radio de la Tierra en metros
    const dLat = (lat2 - lat1) * (Math.PI / 180)
    const dLon = (lon2 - lon1) * (Math.PI / 180)
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  const { nearestGym, distanceToGym } = useMemo(() => {
    if (location && gyms.length > 0) {
      let closestGym = null
      let minDistance = Infinity

      gyms.forEach(gym => {
        const dist = getDistanceFromLatLonInMeters(
          location.lat, location.lng, 
          gym.latitude, gym.longitude
        )
        if (dist < minDistance) {
          minDistance = dist
          closestGym = gym
        }
      })

      return { nearestGym: closestGym, distanceToGym: Math.round(minDistance) }
    }
    return { nearestGym: null, distanceToGym: null }
  }, [location, gyms])

  useEffect(() => {
    const init = async () => {
      await fetchGyms()
      await fetchLeaderboard()
      await fetchWeeklyCheckins()
      await fetchResetStatus()
      getLocation()
    }
    init()
  }, [])

  // Asignar el stream al elemento de video una vez que se renderice en pantalla
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  const startCamera = async () => {
    setError('')
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: { ideal: 'environment' } } 
      })
      setStream(mediaStream)
    } catch (err) {
      setError('No pudimos acceder a la cámara. Revisa los permisos.' + err.message)
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
  }

  const takePhotoAndCheckIn = async () => {
    if (!location) {
      setError('Esperando tu ubicación...')
      return
    }
    
    if (!nearestGym) {
      setError('No hay gimnasios registrados en el sistema.')
      return
    }

    if (distanceToGym > 150) {
      setError(`Estás a ${distanceToGym}m de ${nearestGym.name}. Debes estar a menos de 100m.`)
      return
    }

    setCheckingIn(true)
    setError('')
    setSuccessMsg('')

    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0)
    
    canvas.toBlob(async (blob) => {
      const fileName = `checkin_${session.user.id}_${Date.now()}.jpg`
      
      const { error: uploadError } = await supabase
        .storage
        .from('gymsito')
        .upload(fileName, blob, { contentType: 'image/jpeg' })

      if (uploadError) {
        setError('Error al subir la imagen.')
        setCheckingIn(false)
        stopCamera()
        return
      }

      const { data: publicUrlData } = supabase.storage.from('gymsito').getPublicUrl(fileName)
      const photoUrl = publicUrlData.publicUrl

      const inserts = [
        {
          user_id: session.user.id,
          gym_id: nearestGym.id,
          photo_url: photoUrl,
          user_latitude: location.lat,
          user_longitude: location.lng,
          is_comodin: replacedDay !== '',
          replaced_day: replacedDay !== '' ? parseInt(replacedDay) : null
        }
      ]

      const { error: insertError } = await supabase.from('check_ins').insert(inserts)

      let buddyError = null
      if (selectedBuddy) {
        const buddyInsert = {
          user_id: selectedBuddy,
          gym_id: nearestGym.id,
          photo_url: photoUrl,
          user_latitude: location.lat,
          user_longitude: location.lng,
          is_comodin: false,
          replaced_day: null
        }
        const { error: bErr } = await supabase.from('check_ins').insert(buddyInsert)
        buddyError = bErr
      }

      setCheckingIn(false)
      stopCamera()
      
      const hadBuddy = selectedBuddy
      setSelectedBuddy('')

      if (insertError) {
        setError('Error al registrar tu asistencia.')
      } else if (buddyError) {
        console.error("Error amigo Supabase RLS:", buddyError)
        setError('Tu asistencia se guardó, pero la del acompañante fue rechazada por seguridad de Supabase (RLS).')
        setSuccessMsg('Tu asistencia fue registrada exitosamente.')
        fetchLeaderboard()
        fetchWeeklyCheckins()
      } else {
        setSuccessMsg(hadBuddy 
          ? `Asistencia doble registrada en ${nearestGym.name}.` 
          : `Asistencia registrada en ${nearestGym.name}.`
        )
        fetchLeaderboard()
        fetchWeeklyCheckins() // Recargar progreso semanal

        // Abrir el menú nativo para compartir (WhatsApp, etc.)
        if (navigator.share) {
          try {
            const file = new File([blob], fileName, { type: 'image/jpeg' })
            
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                title: nearestGym.name,
                text: nearestGym.name,
                files: [file]
              })
            } else {
              await navigator.share({
                title: nearestGym.name,
                text: nearestGym.name,
                url: photoUrl
              })
            }
          } catch (err) {
            console.log('El usuario canceló o hubo un error al compartir:', err)
          }
        }
      }
    }, 'image/jpeg')
  }

  if (viewingUser) {
    return <UserHistory user={viewingUser} onBack={() => setViewingUser(null)} />
  }

  const shareLeaderboard = async () => {
    try {
      if (navigator.share) {
        let textResult = 'Resultados Mensuales\n\n'
        leaderboard.forEach((u, idx) => {
          textResult += `${idx + 1}. ${u.full_name.split(' ')[0]} - ${u.total_attendances} Asistencias\n`
        })

        await navigator.share({
          title: 'Resultados Mensuales',
          text: textResult
        })
      }
    } catch (err) {
      console.log('Error al compartir resultados', err)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 font-sans flex justify-center">
      <div className="w-full max-w-md space-y-4">
        
        {/* Header */}
        <header className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 text-gray-800 font-semibold border border-gray-200">
              {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Hola, {profile?.full_name?.split(' ')[0] || 'Atleta'}</h2>
            </div>
          </div>
          <button 
            onClick={() => supabase.auth.signOut()} 
            className="text-sm font-medium text-gray-500 hover:text-black transition-colors"
          >
            Salir
          </button>
        </header>

        {/* Weekly Timeline */}
        <section className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="mb-4 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Esta semana</h3>
            <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded">
              {profile?.target_days?.length || 0} meta
            </span>
          </div>
          
          <div className="flex justify-between items-center px-1 relative">
            {/* LInca conectora de fondo */}
            <div className="absolute top-5 left-4 right-4 h-0.5 bg-gray-100 -z-10"></div>
            
            {[
              { id: 1, label: 'L' },
              { id: 2, label: 'M' },
              { id: 3, label: 'X' },
              { id: 4, label: 'J' },
              { id: 5, label: 'V' },
              { id: 6, label: 'S' },
              { id: 7, label: 'D' }
            ].map(day => {
              const isTarget = profile?.target_days?.includes(day.id)
              const hasAttendedNormal = weeklyCheckins.includes(day.id)
              const hasAttendedComodin = comodinCheckins.includes(day.id)
              const isReplaced = replacedCheckins.includes(day.id)
              const isCurrentDay = today === day.id
              const isPast = day.id < today

              // Estilos y logíca del timeline
              let circleClass = "w-10 h-10 rounded-full flex mx-auto items-center justify-center text-sm font-medium border-[2.5px] transition-all bg-white relative z-10 "
              
              if (hasAttendedNormal) {
                // Asistio normal a su dia
                circleClass += "border-green-500 text-green-600"
              } else if (isReplaced) {
                // Faltó, pero usó comodín para recuperarlo
                circleClass += "border-blue-400 text-blue-500 bg-blue-50"
              } else if (hasAttendedComodin) {
                // Asistio como comodin en dia libre
                circleClass += "border-blue-500 text-blue-600"
              } else if (isTarget && isPast) {
                // Faltó a su día
                circleClass += "border-red-400 text-red-500 bg-red-50"
              } else if (isTarget && !isPast) {
                // Dia objetivo en el futuro (o hoy incompleto)
                circleClass += "border-gray-800 text-gray-800 border-dashed"
              } else {
                // Dia que no va (libre)
                circleClass += "border-gray-200 text-gray-400"
              }

              return (
                <div key={day.id} className="flex flex-col items-center gap-2">
                  <div className={`relative ${isCurrentDay ? 'scale-110 mb-1' : ''}`}>
                    <div className={circleClass}>
                      {day.label}
                    </div>
                    {/* Indicador de "hoy" (ring exterior) */}
                    {isCurrentDay && (
                      <div className="absolute inset-0 rounded-full ring-4 ring-orange-100 -z-10"></div>
                    )}
                  </div>
                  
                  {/* Puntos / Iconitos decorativos abajo del círculo */}
                  <div className="h-4 flex items-center justify-center">
                    {hasAttendedNormal && (
                      <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    )}
                    {isReplaced && (
                      <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    )}
                    {hasAttendedComodin && (
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded uppercase tracking-wider font-bold">CMDN</span>
                    )}
                    {isTarget && isPast && !hasAttendedNormal && !isReplaced && (
                      <svg className="w-3.5 h-3.5 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    )}
                    {isTarget && !isPast && !hasAttendedNormal && (
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                    )}
                    {!isTarget && !hasAttendedComodin && (
                      <div className="w-1 h-1 rounded-full bg-gray-200"></div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Camara / Checkin */}
        <section className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col items-center text-center">
          <h3 className="text-xl font-semibold mb-2">Registro de asistencia</h3>
          <p className="text-gray-500 mb-6 text-sm">Tómate una foto en el gimnasio para registrar tu visita de hoy.</p>

          {/* Estado de validación */}
          <div className="mb-6 w-full flex flex-col items-center gap-3">
            {location && nearestGym ? (
              <div className="w-full flex flex-col items-center gap-2">
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-medium ${
                  distanceToGym <= 100 
                    ? 'bg-green-50 border-green-200 text-green-700' 
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${distanceToGym <= 100 ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  {distanceToGym <= 100 
                    ? `Ubicación válida a ${distanceToGym}m` 
                    : `Muy lejos de ${nearestGym.name} (${distanceToGym}m). Máx 100m.`}
                </div>
                
                {distanceToGym <= 100 && (
                  <div className="w-full mt-1 p-3 bg-gray-50 border border-gray-200 rounded-xl flex border-l-4 border-l-black items-center gap-3 text-left">
                    <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-800 shadow-sm shrink-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Gimnasio Confirmado</p>
                      <h4 className="font-semibold text-gray-900 truncate text-sm">{nearestGym.name}</h4>
                    </div>
                  </div>
                )}
              </div>
            ) : error ? (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm flex flex-col items-center w-full">
                <span>{error}</span>
                <button onClick={getLocation} className="mt-2 font-medium underline text-xs">Intentar de nuevo</button>
              </div>
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 text-gray-500 text-xs font-medium">
                Buscando tu gimnasio más cercano...
              </span>
            )}
            
            {successMsg && (
              <div className="bg-green-50 border border-green-100 text-green-700 w-full px-4 py-3 rounded-lg text-sm text-center">
                {successMsg}
              </div>
            )}
          </div>

          {/* Area de Camara */}
          {(weeklyCheckins.includes(today) || comodinCheckins.includes(today)) ? (
            <div className="bg-blue-50 border border-blue-100 text-blue-700 px-4 py-3 rounded-lg text-sm w-full max-w-xs mb-2">
              <span className="font-semibold block mb-1">Asistencia marcada para hoy</span>
            </div>
          ) : !stream ? (
            <button 
              onClick={startCamera} 
              disabled={!nearestGym || distanceToGym > 100}
              className="px-6 py-3 w-full max-w-xs font-medium text-white transition-colors bg-black rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Abrir Cámara
            </button>
          ) : (
            <div className="w-full flex flex-col items-center">
              
              {/* Opcion de Comodín si hoy NO es su dia */}
              {!isTargetDay && (
                <div className="w-full max-w-xs mb-4 text-left bg-orange-50 p-3 rounded-lg border border-orange-100">
                  <p className="text-xs font-semibold text-orange-800 mb-1">
                    Hoy no es tu día asignado
                  </p>
                  {(() => {
                    const dayNames = {1:'Lunes', 2:'Martes', 3:'Miércoles', 4:'Jueves', 5:'Viernes', 6:'Sábado', 7:'Domingo'}
                    const availableMissedDays = profile?.target_days?.filter(day => 
                      !weeklyCheckins.includes(day) && !replacedCheckins.includes(day)
                    ) || []

                    if (availableMissedDays.length === 0) {
                      return (
                        <p className="text-xs text-orange-700 mt-1">
                          No tienes días pendientes por reponer en tu meta.
                        </p>
                      )
                    }

                    return (
                      <div className="mt-2">
                        <label className="block text-xs font-medium text-orange-800 mb-1">
                          Usar comodín para reponer:
                        </label>
                        <select
                          value={replacedDay}
                          onChange={(e) => setReplacedDay(e.target.value)}
                          className="w-full p-2 border border-orange-200 rounded text-sm bg-white text-orange-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        >
                          <option value="">No usar comodín (solo asistir)</option>
                          {availableMissedDays.map(day => (
                            <option key={day} value={day}>
                              Día {dayNames[day]}
                            </option>
                          ))}
                        </select>
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Selector de acompañante */}
              <div className="w-full max-w-xs mb-4 text-left">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  ¿Entrenaste con alguien? (Opcional)
                </label>
                <select 
                  value={selectedBuddy}
                  onChange={(e) => setSelectedBuddy(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black transition-colors"
                >
                  <option value="">Nadie / Fui solo</option>
                  {leaderboard
                    .filter((u) => u.user_id !== session.user.id)
                    .map((u) => (
                      <option key={u.user_id} value={u.user_id}>
                        {u.full_name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="w-full max-w-xs rounded-xl overflow-hidden bg-black mb-4 aspect-[3/4] relative">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              </div>
              
              <div className="flex gap-2 w-full max-w-xs">
                <button 
                  onClick={stopCamera} 
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={takePhotoAndCheckIn} 
                  disabled={checkingIn || !location}
                  className="flex-[2] px-4 py-2.5 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {checkingIn ? 'Guardando...' : 'Tomar Foto'}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Leaderboard */}
        <section className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
          <div className="mb-6 flex justify-between items-end gap-2">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Ranking</h3>
              <p className="text-sm text-gray-500">Compara tus asistencias este mes.</p>
            </div>
            {isLastDayOfMonth && leaderboard.length > 0 && (
              <button 
                onClick={shareLeaderboard}
                className="text-xs font-bold bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
                title="Compartir resultados finales"
              >
                Compartir
              </button>
            )}
          </div>

          {/* End of month banner */}
          {isLastDayOfMonth && (
            <div className="mb-5">
              <button 
                onClick={resetMyMonth}
                disabled={isResetting || resetStatus.isReady}
                className="w-full bg-gray-100 text-gray-800 border border-gray-200 disabled:bg-gray-50 disabled:text-gray-400 font-semibold text-sm px-4 py-3 rounded-lg transition-colors"
              >
                {isResetting ? 'Procesando...' : resetStatus.isReady ? 'Confirmado' : 'Reiniciar'}
              </button>
              <p className="text-center text-xs text-gray-500 mt-2">
                Faltan {resetStatus.totalCount - resetStatus.readyCount} confirmaciones
              </p>
            </div>
          )}

          <div className="space-y-3">
            {leaderboard.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-100">
                Aún no hay atletas registrados.
              </div>
            ) : (
              leaderboard.map((user, idx) => (
                <div 
                  key={user.user_id} 
                  onClick={() => setViewingUser(user)}
                  className="flex items-center p-3 rounded-lg border border-gray-100 bg-gray-50 flex-wrap cursor-pointer hover:bg-gray-100 hover:border-gray-200 transition-colors"
                >
                  <div className="text-sm font-medium w-6 text-gray-400">
                    {idx + 1}
                  </div>
                  
                  <img 
                    src={user.avatar_url || 'https://via.placeholder.com/100'} 
                    alt={user.full_name} 
                    className="w-10 h-10 rounded-full object-cover border border-gray-200 mr-3" 
                  />
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 text-sm truncate">{user.full_name || 'Usuario'}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Meta: {user.target_days?.length || 0} días/sem
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <span className="block text-lg font-semibold text-gray-900">{user.total_attendances}</span>
                    <span className="text-[10px] text-gray-500 uppercase tracking-wide">Asistencias</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

      </div>
    </div>
  )
}
