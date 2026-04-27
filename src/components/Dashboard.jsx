import { useState, useRef, useEffect } from 'react'
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
  const videoRef = useRef(null)

  // Detectar si hoy es un dia programado (1=Lunes, 7=Domingo)
  const today = new Date().getDay() || 7 
  const isTargetDay = profile?.target_days?.includes(today)

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

  useEffect(() => {
    const init = async () => {
      await fetchGyms()
      await fetchLeaderboard()
      await fetchWeeklyCheckins()
      getLocation()
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startCamera = async () => {
    setError('')
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch {
      setError('No pudimos acceder a la cámara. Revisa los permisos.')
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
    
    const nearestGym = gyms[0] 
    if (!nearestGym) {
      setError('No hay gimnasios registrados en el sistema.')
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

      if (selectedBuddy) {
        inserts.push({
          user_id: selectedBuddy,
          gym_id: nearestGym.id,
          photo_url: photoUrl,
          user_latitude: location.lat,
          user_longitude: location.lng,
          is_comodin: false, // Para el amigo no asignamos comodín automático
          replaced_day: null
        })
      }

      const { error: insertError } = await supabase.from('check_ins').insert(inserts)

      setCheckingIn(false)
      stopCamera()
      setSelectedBuddy('')

      if (insertError) {
        setError('Error al registrar la asistencia.')
      } else {
        setSuccessMsg(selectedBuddy 
          ? `Asistencia doble registrada en ${nearestGym.name}.` 
          : `Asistencia registrada en ${nearestGym.name}.`
        )
        fetchLeaderboard()
        fetchWeeklyCheckins() // Recargar progreso semanal
      }
    }, 'image/jpeg')
  }

  if (viewingUser) {
    return <UserHistory user={viewingUser} onBack={() => setViewingUser(null)} />
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 font-sans flex justify-center">
      <div className="w-full max-w-md space-y-6">
        
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
            {location ? (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-gray-50 border border-gray-200 text-gray-700 text-xs font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                Ubicación verificada
              </span>
            ) : error ? (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm flex flex-col items-center w-full">
                <span>{error}</span>
                <button onClick={getLocation} className="mt-2 font-medium underline text-xs">Intentar de nuevo</button>
              </div>
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 text-gray-500 text-xs font-medium">
                Buscando ubicación...
              </span>
            )}
            
            {successMsg && (
              <div className="bg-green-50 border border-green-100 text-green-700 w-full px-4 py-3 rounded-lg text-sm text-center">
                {successMsg}
              </div>
            )}
          </div>

          {/* Area de Camara */}
          {!stream ? (
            <button 
              onClick={startCamera} 
              className="px-6 py-3 w-full max-w-xs font-medium text-white transition-colors bg-black rounded-lg hover:bg-gray-800"
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
                  <label className="flex items-center gap-2 text-sm text-orange-800 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={useComodin}
                      onChange={(e) => setUseComodin(e.target.checked)}
                      className="rounded text-orange-600 focus:ring-orange-500" 
                    />
                    Usar un comodín para hoy
                  </label>
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
        <section className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Ranking</h3>
            <p className="text-sm text-gray-500">Compara tus asistencias este mes.</p>
          </div>
          
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
