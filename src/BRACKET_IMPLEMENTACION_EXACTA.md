# 🏆 Documentación Completa del Bracket Implementado (BracketViewEnhanced)

## 📌 Propósito

Este documento contiene TODOS los detalles de implementación del bracket actual desde Octavos hasta Final, tal como está construido en `/src/app/components/BracketViewEnhanced.tsx`.

**Incluye absolutamente TODO:**
- ✅ Estructura completa
- ✅ Todos los márgenes, padding, gaps
- ✅ Contenedores y wrappers
- ✅ Layout desktop y mobile
- ✅ Conectores SVG
- ✅ MatchBox completo
- ✅ Dimensiones exactas
- ✅ Backgrounds y gradientes
- ✅ Posicionamiento
- ✅ Grid layouts
- ✅ Responsive breakpoints

---

## 📐 Variables Globales del Bracket

```typescript
const BRACKET_CONSTANTS = {
  // Desktop
  matchHeight: 130,              // Altura aproximada de cada MatchBox
  matchWidth: 80,                // Ancho del MatchBox: w-20 (80px)
  columnGap: 64,                 // gap-16 (16 * 4px = 64px)
  connectorWidth: 40,            // Ancho de conectores entre columnas
  minWidth: 1200,                // min-w-[1200px] - ancho mínimo desktop
  
  // Octavos spacing
  octavosHeight: '672px',        // matchHeight * 4 + 48 * 3 = 130*4 + 144 = 672px
  octavosVerticalGap: 48,        // Espacio entre partidos de octavos
  
  // Padding contenedores
  desktopPadding: 32,            // p-8 (8 * 4px = 32px)
  desktopPaddingY: 48,           // py-12 (12 * 4px = 48px)
  mobilePaddingY: 32,            // py-8 (8 * 4px = 32px)
  mobilePaddingX: 8,             // px-2 (2 * 4px = 8px)
  
  // Mobile
  mobileMaxWidth: 448,           // max-w-md (28rem = 448px)
  mobileMaxWidthSm: 384,         // max-w-sm (24rem = 384px)
  mobileOctavosGap: 8,           // gap-2 (2 * 4px = 8px)
  mobileCuartosGap: 32,          // gap-8 (8 * 4px = 32px)
  mobileSectionGap: 32,          // gap-8 entre secciones (octavos, cuartos, etc.)
  
  // Conectores mobile
  connectorHeight: 60,           // Octavos
  connectorHeightCuartos: 80,    // Cuartos
  connectorHeightSemis: 32,      // h-8 (8 * 4px = 32px) - línea recta
};
```

---

## 🖼️ Contenedor Principal - Desktop

### Estructura Completa

```tsx
<div className="hidden lg:block relative p-8 overflow-x-auto bg-gradient-to-br from-blue-50 via-white to-green-50 min-h-screen">
  {/* 
    hidden lg:block - Solo visible en desktop (≥1024px)
    relative - Para posicionamiento absoluto de hijos
    p-8 - Padding 32px todos lados
    overflow-x-auto - Scroll horizontal si necesario
    bg-gradient-to-br from-blue-50 via-white to-green-50 - Gradiente diagonal
    min-h-screen - Altura mínima 100vh
  */}
  
  <div className="flex justify-center items-center min-w-[1200px] mx-auto py-12">
    {/*
      flex justify-center items-center - Centra contenido horizontal y vertical
      min-w-[1200px] - Ancho mínimo 1200px (activa overflow si pantalla < 1200px)
      mx-auto - Margin horizontal auto (centra)
      py-12 - Padding vertical 48px (arriba y abajo)
    */}
    
    <div className="relative flex gap-16 items-start">
      {/*
        relative - Para posicionamiento absoluto de conectores
        flex - Layout horizontal
        gap-16 - Gap de 64px entre columnas principales (izquierda, centro, derecha)
        items-start - Alineación vertical arriba
      */}
      
      {/* Aquí va el contenido del bracket */}
    </div>
  </div>
</div>
```

---

## 🎯 MatchBox - Componente de Partido

### Estructura Completa

```tsx
const MatchBox: React.FC<{
  match: Match;
  date: string;
  phase: 'dieciseisavos' | 'octavos' | 'cuartos' | 'semifinales' | 'final';
  label?: string;
}> = ({ match, date, phase, label }) => {
  const canSelect = match.team1 && match.team2;
  const hasWinner = match.winner !== null;

  return (
    <div className="relative flex items-center">
      {/* 
        relative - Para posicionar label y conectores
        flex items-center - Para alinear match card con posibles conectores
      */}
      
      {/* Match Card */}
      <div className="relative">
        
        {/* Label Superior (FINAL, BRONCE, etc.) */}
        {label && (
          <div className="absolute -top-7 left-0 right-0 text-center z-10">
            {/*
              absolute - Posicionamiento absoluto
              -top-7 - 28px arriba del card (7 * 4px = 28px)
              left-0 right-0 - Ancho completo del card
              text-center - Texto centrado
              z-10 - Z-index 10 para estar sobre otros elementos
            */}
            <span className="px-2 py-1 bg-yellow-400 text-gray-900 text-[10px] font-bold rounded shadow-md uppercase">
              {/*
                px-2 - Padding horizontal 8px
                py-1 - Padding vertical 4px
                bg-yellow-400 - Fondo amarillo
                text-gray-900 - Texto gris oscuro
                text-[10px] - Tamaño 10px
                font-bold - Peso bold (700)
                rounded - Border radius 4px
                shadow-md - Sombra media
                uppercase - MAYÚSCULAS
              */}
              {label}
            </span>
          </div>
        )}
        
        {/* Card Container */}
        <div className={`
          relative z-[1] 
          flex flex-col items-center gap-1 
          p-2 
          rounded-[10px] 
          w-20 h-20
          transition-shadow
          ${hasWinner 
            ? 'bg-green-50 border-2 border-green-500 shadow-lg' 
            : 'bg-white border-2 border-gray-300 hover:shadow-md'
          }
        `}>
          {/*
            relative z-[1] - Z-index 1 para estar sobre conectores
            flex flex-col - Layout vertical
            items-center - Centrado horizontal
            gap-1 - Gap 4px entre elementos
            p-2 - Padding 8px todos lados
            rounded-[10px] - Border radius 10px
            w-20 - Ancho 80px (20 * 4px)
            h-20 - Alto 80px (20 * 4px)
            transition-shadow - Transición suave de sombra
            
            SI HAY GANADOR:
              bg-green-50 - Fondo verde claro
              border-2 - Border 2px
              border-green-500 - Color verde
              shadow-lg - Sombra grande
            
            SI NO HAY GANADOR:
              bg-white - Fondo blanco
              border-2 - Border 2px
              border-gray-300 - Color gris
              hover:shadow-md - Sombra media al hover
          */}
          
          {/* Team Names Container */}
          <div className="flex items-center justify-evenly w-full">
            {/*
              flex - Layout horizontal
              items-center - Centrado vertical
              justify-evenly - Espacio equitativo entre equipos
              w-full - Ancho 100%
            */}
            
            {/* TeamButton para team1 */}
            <TeamButton
              teamId={match.team1}
              isWinner={match.winner === match.team1}
              onClick={() => match.team1 && handleSelectWinner(phase, match.id, match.team1)}
              disabled={!canSelect || hasWinner}
            />
            
            {/* TeamButton para team2 */}
            <TeamButton
              teamId={match.team2}
              isWinner={match.winner === match.team2}
              onClick={() => match.team2 && handleSelectWinner(phase, match.id, match.team2)}
              disabled={!canSelect || hasWinner}
            />
          </div>
          
          {/* Match Date */}
          <div className="text-center text-[8px] font-semibold text-gray-600 mt-auto">
            {/*
              text-center - Centrado
              text-[8px] - Tamaño 8px
              font-semibold - Peso semibold (600)
              text-gray-600 - Color gris
              mt-auto - Margin top auto (empuja hacia abajo)
            */}
            {date}
          </div>
        </div>
      </div>
    </div>
  );
};
```

---

## 👤 TeamButton - Botón de Equipo

```tsx
const TeamButton: React.FC<{
  teamId: string | null;
  isWinner: boolean;
  onClick: () => void;
  disabled?: boolean;
}> = ({ teamId, isWinner, onClick, disabled }) => {
  // Si no hay equipo
  if (!teamId) {
    return (
      <div className="flex flex-col items-center gap-2 w-9">
        {/*
          flex flex-col - Layout vertical
          items-center - Centrado horizontal
          gap-2 - Gap 8px entre bandera y código
          w-9 - Ancho 36px (9 * 4px)
        */}
        <div className="w-5 h-5 bg-gray-300 rounded"></div>
        {/*
          w-5 h-5 - Placeholder bandera: 20px × 20px
          bg-gray-300 - Fondo gris
          rounded - Border radius 4px
        */}
        <span className="text-[10px] text-gray-400 font-medium">???</span>
        {/*
          text-[10px] - Tamaño 10px
          text-gray-400 - Color gris claro
          font-medium - Peso medium (500)
        */}
      </div>
    );
  }

  const team = getTeamById(teamId);
  if (!team) return null;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex flex-col items-center gap-2 w-9 transition-all
        ${isWinner ? 'opacity-100' : 'opacity-70 hover:opacity-100'}
        ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {/*
        flex flex-col - Layout vertical
        items-center - Centrado
        gap-2 - Gap 8px
        w-9 - Ancho 36px
        transition-all - Transición suave de todas las propiedades
        
        SI ES GANADOR:
          opacity-100 - Opacidad 100%
        SI NO ES GANADOR:
          opacity-70 - Opacidad 70%
          hover:opacity-100 - 100% al hover
        
        SI ESTÁ DISABLED:
          cursor-not-allowed - Cursor de "no permitido"
        SI NO:
          cursor-pointer - Cursor pointer
      */}
      
      {/* Bandera */}
      <img
        src={getFlagUrl(team.code)}
        alt={team.name}
        className={`w-5 h-5 object-cover rounded shadow-sm ${isWinner ? 'ring-2 ring-green-500' : ''}`}
      />
      {/*
        w-5 h-5 - Tamaño 20px × 20px
        object-cover - Cubrir área sin distorsión
        rounded - Border radius 4px
        shadow-sm - Sombra pequeña
        
        SI ES GANADOR:
          ring-2 - Ring de 2px
          ring-green-500 - Color verde
      */}
      
      {/* Código del equipo */}
      <span className={`text-[10px] font-semibold ${isWinner ? 'text-green-700 font-bold' : 'text-gray-700'}`}>
        {team.code}
      </span>
      {/*
        text-[10px] - Tamaño 10px
        font-semibold - Peso semibold (600) por defecto
        
        SI ES GANADOR:
          text-green-700 - Color verde
          font-bold - Peso bold (700)
        SI NO:
          text-gray-700 - Color gris
      */}
    </button>
  );
};
```

---

## 🏗️ Layout Desktop - Estructura Completa

### Izquierda - Octavos + Cuartos + Semifinal

```tsx
{/* IZQUIERDA */}
<div className="flex gap-16">
  {/*
    flex - Layout horizontal
    gap-16 - Gap 64px entre columnas (octavos, cuartos, semifinal)
  */}
  
  {/* Octavos Izquierda (4 partidos) */}
  <div className="flex flex-col justify-around" style={{ height: `${matchHeight * 4 + 48 * 3}px` }}>
    {/*
      flex flex-col - Layout vertical
      justify-around - Distribuye espacio equitativamente
      height: 672px - Calculado: (130px * 4 partidos) + (48px * 3 gaps) = 672px
    */}
    
    {octavos.slice(0, 4).map((match, idx) => (
      <div key={match.id} className="relative">
        {/* relative - Para posicionar conectores */}
        
        <MatchBox
          match={match}
          date={dates.octavos[idx]}
          phase="octavos"
        />
        
        {/* Conectores para pares 0-1 y 2-3 */}
        {(idx === 0 || idx === 2) && (
          <BracketConnector
            position="top"
            direction="right"
            height={matchHeight}        // 130px
            width={40}                  // 40px
          />
        )}
        {(idx === 1 || idx === 3) && (
          <BracketConnector
            position="bottom"
            direction="right"
            height={matchHeight}        // 130px
            width={40}                  // 40px
          />
        )}
      </div>
    ))}
  </div>

  {/* Cuartos Izquierda (2 partidos) */}
  <div className="flex flex-col justify-around" style={{ height: `${matchHeight * 4 + 48 * 3}px` }}>
    {/*
      flex flex-col - Layout vertical
      justify-around - Distribuye espacio equitativamente
      height: 672px - Misma altura que octavos para alineación
    */}
    
    {cuartos.slice(0, 2).map((match, idx) => (
      <div key={match.id} className="relative">
        <MatchBox
          match={match}
          date={dates.cuartos[idx]}
          phase="cuartos"
        />
        <BracketConnector
          position={idx === 0 ? 'top' : 'bottom'}
          direction="right"
          height={matchHeight * 2 + 48}  // 130*2 + 48 = 308px
          width={40}                     // 40px
        />
      </div>
    ))}
  </div>

  {/* Semifinal Izquierda (1 partido) */}
  <div className="flex items-center" style={{ height: `${matchHeight * 4 + 48 * 3}px` }}>
    {/*
      flex items-center - Centra verticalmente
      height: 672px - Misma altura para alineación
    */}
    
    {semifinales[0] && (
      <div className="relative">
        <MatchBox
          match={semifinales[0]}
          date={dates.semifinales[0]}
          phase="semifinales"
        />
        <BracketConnector
          position="top"
          direction="right"
          height={matchHeight * 4}       // 130*4 = 520px
          width={40}                     // 40px
          type="semifinal"               // Tipo especial (línea recta)
        />
      </div>
    )}
  </div>
</div>
```

---

### Centro - Campeón + Final + Tercer Puesto

```tsx
{/* CENTRO - Campeón y Final */}
<div className="flex flex-col items-center justify-center gap-8 px-8" style={{ height: `${matchHeight * 4 + 48 * 3}px` }}>
  {/*
    flex flex-col - Layout vertical
    items-center - Centrado horizontal
    justify-center - Centrado vertical
    gap-8 - Gap 32px entre elementos (campeón, final, bronce)
    px-8 - Padding horizontal 32px (izquierda y derecha)
    height: 672px - Altura total del bracket
  */}
  
  {/* Campeón */}
  <div className="flex flex-col items-center gap-3">
    {/*
      flex flex-col - Layout vertical
      items-center - Centrado
      gap-3 - Gap 12px entre trofeo y texto
    */}
    <TrophyWithFlag
      teamId={state.champion}
      size="lg"                 // Tamaño grande
    />
    <span className="text-base text-gray-800 font-black tracking-wide uppercase">
      {/*
        text-base - Tamaño 16px
        text-gray-800 - Color gris oscuro
        font-black - Peso 900 (muy bold)
        tracking-wide - Letter spacing 0.025em
        uppercase - MAYÚSCULAS
      */}
      Campeón
    </span>
  </div>

  {/* Final */}
  {final && (
    <div className="my-4">
      {/* my-4 - Margin vertical 16px (arriba y abajo) */}
      <MatchBox
        match={final}
        date={dates.final}
        phase="final"
        label="FINAL"
      />
    </div>
  )}

  {/* Tercer Puesto */}
  {semifinales.length === 2 && (
    <div className="mt-8">
      {/* mt-8 - Margin top 32px */}
      <MatchBox
        match={{
          id: 'tercerPuesto',
          team1: semifinales[0]?.winner === semifinales[0]?.team1 
            ? semifinales[0]?.team2 
            : semifinales[0]?.team1,
          team2: semifinales[1]?.winner === semifinales[1]?.team1 
            ? semifinales[1]?.team2 
            : semifinales[1]?.team1,
          winner: null,
        }}
        date={dates.tercerPuesto}
        phase="semifinales"
        label="FINAL DE BRONCE"
      />
    </div>
  )}
</div>
```

---

### Derecha - Semifinal + Cuartos + Octavos

```tsx
{/* DERECHA - Estructura ESPEJO de la izquierda */}
<div className="flex gap-16">
  {/* flex gap-16 - Layout horizontal, gap 64px */}
  
  {/* Semifinal Derecha */}
  <div className="flex items-center" style={{ height: `${matchHeight * 4 + 48 * 3}px` }}>
    {semifinales[1] && (
      <div className="relative">
        <MatchBox
          match={semifinales[1]}
          date={dates.semifinales[1]}
          phase="semifinales"
        />
        <BracketConnector
          position="bottom"              // DIFERENTE: bottom (vs top en izquierda)
          direction="left"               // DIFERENTE: left (vs right en izquierda)
          height={matchHeight * 4}       // 520px
          width={40}
          type="semifinal"
        />
      </div>
    )}
  </div>

  {/* Cuartos Derecha */}
  <div className="flex flex-col justify-around" style={{ height: `${matchHeight * 4 + 48 * 3}px` }}>
    {cuartos.slice(2, 4).map((match, idx) => (
      <div key={match.id} className="relative">
        <MatchBox
          match={match}
          date={dates.cuartos[idx + 2]}
          phase="cuartos"
        />
        <BracketConnector
          position={idx === 0 ? 'top' : 'bottom'}
          direction="left"               // DIFERENTE: left
          height={matchHeight * 2 + 48}
          width={40}
        />
      </div>
    ))}
  </div>

  {/* Octavos Derecha */}
  <div className="flex flex-col justify-around" style={{ height: `${matchHeight * 4 + 48 * 3}px` }}>
    {octavos.slice(4, 8).map((match, idx) => (
      <div key={match.id} className="relative">
        <MatchBox
          match={match}
          date={dates.octavos[idx + 4]}
          phase="octavos"
        />
        {/* Conectores para pares 0-1 y 2-3 */}
        {(idx === 0 || idx === 2) && (
          <BracketConnector
            position="top"
            direction="left"              // DIFERENTE: left
            height={matchHeight}
            width={40}
          />
        )}
        {(idx === 1 || idx === 3) && (
          <BracketConnector
            position="bottom"
            direction="left"              // DIFERENTE: left
            height={matchHeight}
            width={40}
          />
        )}
      </div>
    ))}
  </div>
</div>
```

---

## 📱 Layout Mobile - Estructura Completa

### Contenedor Principal Mobile

```tsx
<div className="lg:hidden relative bg-gradient-to-br from-blue-50 via-white to-green-50 min-h-screen">
  {/*
    lg:hidden - Solo visible en mobile (<1024px)
    relative - Para posicionamiento absoluto
    bg-gradient-to-br from-blue-50 via-white to-green-50 - Mismo gradiente que desktop
    min-h-screen - Altura mínima 100vh
  */}
  
  <div className="grid place-items-center items-center py-8 px-2 gap-8">
    {/*
      grid - Layout grid
      place-items-center - Centra items horizontal y verticalmente
      items-center - Centra verticalmente
      py-8 - Padding vertical 32px
      px-2 - Padding horizontal 8px
      gap-8 - Gap 32px entre secciones
    */}
    
    {/* Aquí va el contenido */}
  </div>
</div>
```

---

### Octavos Mobile - Llave Superior

```tsx
{/* Octavos Llave 1 (Superior) - 4 partidos */}
{octavos.length > 0 && (
  <div className="w-full max-w-md">
    {/*
      w-full - Ancho 100%
      max-w-md - Ancho máximo 448px (28rem)
    */}
    
    <div className="grid grid-cols-4 gap-2 place-items-center relative">
      {/*
        grid - Layout grid
        grid-cols-4 - 4 columnas
        gap-2 - Gap 8px entre elementos
        place-items-center - Centra items
        relative - Para posicionar conectores
      */}
      
      {octavos.slice(0, 4).map((match, idx) => (
        <div key={match.id} className="grid place-items-center relative">
          {/*
            grid place-items-center - Centra el MatchBox
            relative - Para posicionar conectores
          */}
          
          <MatchBox
            match={match}
            date={dates.octavos[idx]}
            phase="octavos"
          />
          
          {/* Conectores hacia abajo para primera llave */}
          {(idx === 0 || idx === 2) && (
            <BracketConnector
              position="top"
              direction="down"           // MOBILE: hacia abajo
              height={60}                // 60px
              width={40}
            />
          )}
          {(idx === 1 || idx === 3) && (
            <BracketConnector
              position="bottom"
              direction="down"           // MOBILE: hacia abajo
              height={60}
              width={40}
            />
          )}
        </div>
      ))}
    </div>
  </div>
)}
```

---

### Cuartos Mobile - Llave Superior

```tsx
{/* Cuartos Llave 1 (Superior) - 2 partidos */}
{cuartos.length > 0 && (
  <div className="w-full max-w-sm">
    {/*
      w-full - Ancho 100%
      max-w-sm - Ancho máximo 384px (24rem) - MÁS ESTRECHO que octavos
    */}
    
    <div className="grid grid-cols-2 gap-8 place-items-center relative">
      {/*
        grid-cols-2 - 2 columnas
        gap-8 - Gap 32px - MÁS GRANDE que octavos (8px)
        place-items-center - Centra items
        relative - Para conectores
      */}
      
      {cuartos.slice(0, 2).map((match, idx) => (
        <div key={match.id} className="grid place-items-center relative">
          <MatchBox
            match={match}
            date={dates.cuartos[idx]}
            phase="cuartos"
          />
          
          {/* Conectores hacia abajo */}
          {idx === 0 && (
            <BracketConnector
              position="top"
              direction="down"
              height={80}              // 80px - MÁS LARGO que octavos (60px)
              width={60}               // 60px - MÁS ANCHO que octavos (40px)
            />
          )}
          {idx === 1 && (
            <BracketConnector
              position="bottom"
              direction="down"
              height={80}
              width={60}
            />
          )}
        </div>
      ))}
    </div>
  </div>
)}
```

---

### Semifinal 1 Mobile

```tsx
{/* Semifinal 1 */}
{semifinales.length > 0 && semifinales[0] && (
  <div className="grid place-items-center relative">
    {/* grid place-items-center - Centra el MatchBox */}
    
    <MatchBox
      match={semifinales[0]}
      date={dates.semifinales[0]}
      phase="semifinales"
    />
    
    {/* Conector hacia la final (línea recta hacia abajo) */}
    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0.5 h-8 bg-gray-400" />
    {/*
      absolute - Posicionamiento absoluto
      top-full - Posicionado justo debajo del MatchBox
      left-1/2 - Posicionado en el centro horizontal (50%)
      -translate-x-1/2 - Ajuste para centrado exacto
      w-0.5 - Ancho 2px (0.5 * 4px)
      h-8 - Alto 32px (8 * 4px)
      bg-gray-400 - Color gris
    */}
  </div>
)}
```

---

### Fila Final Mobile - 3 Columnas

```tsx
{/* Fila Final: 3 Columnas (Bronce | Final | Campeón) */}
<div className="grid grid-cols-3 gap-4 items-center w-full max-w-md">
  {/*
    grid - Layout grid
    grid-cols-3 - 3 columnas iguales
    gap-4 - Gap 16px entre columnas
    items-center - Alineación vertical centrada
    w-full - Ancho 100%
    max-w-md - Ancho máximo 448px
  */}
  
  {/* Columna 1: Final de Bronce */}
  <div className="grid place-items-center">
    {/* grid place-items-center - Centra contenido */}
    
    {semifinales.length === 2 && (
      <MatchBox
        match={{
          id: 'tercerPuesto',
          team1: semifinales[0]?.winner === semifinales[0]?.team1 
            ? semifinales[0]?.team2 
            : semifinales[0]?.team1,
          team2: semifinales[1]?.winner === semifinales[1]?.team1 
            ? semifinales[1]?.team2 
            : semifinales[1]?.team1,
          winner: null,
        }}
        date={dates.tercerPuesto}
        phase="semifinales"
        label="BRONCE"              // Label más corto que desktop
      />
    )}
  </div>

  {/* Columna 2: Final */}
  <div className="grid place-items-center relative">
    {final && (
      <>
        <MatchBox 
          match={final} 
          date={dates.final} 
          phase="final" 
          label="FINAL" 
        />
        {/* Conector hacia el campeón (línea recta hacia abajo) */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0.5 h-8 bg-gray-400" />
      </>
    )}
  </div>

  {/* Columna 3: Campeón */}
  <div className="grid place-items-center">
    <TrophyWithFlag
      teamId={state.champion}
      size="sm"                     // Tamaño pequeño (vs "lg" en desktop)
    />
  </div>
</div>
```

---

### Semifinal 2 Mobile

```tsx
{/* Semifinal 2 */}
{semifinales.length > 1 && semifinales[1] && (
  <div className="grid place-items-center relative">
    <MatchBox
      match={semifinales[1]}
      date={dates.semifinales[1]}
      phase="semifinales"
    />
    
    {/* Conector hacia la final (línea recta hacia ARRIBA) */}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0.5 h-8 bg-gray-400" />
    {/*
      bottom-full - Posicionado justo ARRIBA del MatchBox (vs top-full en semi1)
      Resto igual que semifinal 1
    */}
  </div>
)}
```

---

### Cuartos Mobile - Llave Inferior

```tsx
{/* Cuartos Llave 2 (Inferior) - 2 partidos */}
{cuartos.length > 2 && (
  <div className="w-full max-w-sm">
    <div className="grid grid-cols-2 gap-8 place-items-center relative">
      {cuartos.slice(2, 4).map((match, idx) => (
        <div key={match.id} className="grid place-items-center relative">
          <MatchBox
            match={match}
            date={dates.cuartos[idx + 2]}
            phase="cuartos"
          />
          
          {/* Conectores hacia ARRIBA (vs abajo en llave superior) */}
          {idx === 0 && (
            <BracketConnector
              position="top"
              direction="up"            // DIFERENTE: hacia arriba
              height={80}
              width={60}
            />
          )}
          {idx === 1 && (
            <BracketConnector
              position="bottom"
              direction="up"            // DIFERENTE: hacia arriba
              height={80}
              width={60}
            />
          )}
        </div>
      ))}
    </div>
  </div>
)}
```

---

### Octavos Mobile - Llave Inferior

```tsx
{/* Octavos Llave 2 (Inferior) - 4 partidos */}
{octavos.length > 4 && (
  <div className="w-full max-w-md">
    <div className="grid grid-cols-4 gap-2 place-items-center relative">
      {octavos.slice(4, 8).map((match, idx) => (
        <div key={match.id} className="grid place-items-center relative">
          <MatchBox
            match={match}
            date={dates.octavos[idx + 4]}
            phase="octavos"
          />
          
          {/* Conectores hacia ARRIBA (vs abajo en llave superior) */}
          {(idx === 0 || idx === 2) && (
            <BracketConnector
              position="top"
              direction="up"            // DIFERENTE: hacia arriba
              height={60}
              width={40}
            />
          )}
          {(idx === 1 || idx === 3) && (
            <BracketConnector
              position="bottom"
              direction="up"            // DIFERENTE: hacia arriba
              height={60}
              width={40}
            />
          )}
        </div>
      ))}
    </div>
  </div>
)}
```

---

## 📅 Fechas de Partidos

```typescript
const dates = {
  octavos: [
    '4 jul',   // Match 0
    '4 jul',   // Match 1
    '5 jul',   // Match 2
    '5 jul',   // Match 3
    '6 jul',   // Match 4
    '6 jul',   // Match 5
    '7 jul',   // Match 6
    '7 jul',   // Match 7
  ],
  cuartos: [
    '9 jul',   // Match 0
    '9 jul',   // Match 1
    '10 jul',  // Match 2
    '10 jul',  // Match 3
  ],
  semifinales: [
    '14 jul',  // Semifinal 1
    '15 jul',  // Semifinal 2
  ],
  tercerPuesto: '18 jul',
  final: '19 jul',
};
```

---

## 🔗 BracketConnector - Props

```typescript
interface BracketConnectorProps {
  position: 'top' | 'bottom';       // Desde dónde sale la línea
  direction: 'left' | 'right' | 'down' | 'up';  // Hacia dónde va
  height: number;                   // Altura del conector (px)
  width: number;                    // Ancho del conector (px)
  type?: 'normal' | 'semifinal';    // Tipo: curva Bézier o línea recta
}
```

### Uso de Conectores

**Desktop:**
- Octavos → Cuartos: `height={130}` (matchHeight)
- Cuartos → Semifinales: `height={308}` (matchHeight * 2 + 48)
- Semifinales → Final: `height={520}` (matchHeight * 4), `type="semifinal"`
- Todos: `width={40}`

**Mobile:**
- Octavos → Cuartos: `height={60}`, `width={40}`, `direction="down"` o `"up"`
- Cuartos → Semifinales: `height={80}`, `width={60}`, `direction="down"` o `"up"`
- Semifinales → Final: Línea CSS simple (`h-8`, `w-0.5`)

---

## 🎨 Backgrounds y Gradientes

### Desktop

```tsx
className="bg-gradient-to-br from-blue-50 via-white to-green-50"
```
- `bg-gradient-to-br` - Gradiente diagonal (bottom-right)
- `from-blue-50` - Inicia azul muy claro
- `via-white` - Pasa por blanco en el centro
- `to-green-50` - Termina verde muy claro

### Mobile

Mismo gradiente que desktop

---

## 📊 Tabla de Dimensiones Completa

| Elemento | Desktop | Mobile | Notas |
|----------|---------|--------|-------|
| **MatchBox** |
| Ancho | `w-20` (80px) | `w-20` (80px) | Igual |
| Alto | `h-20` (80px) | `h-20` (80px) | Igual |
| Padding | `p-2` (8px) | `p-2` (8px) | Igual |
| Border radius | `rounded-[10px]` | `rounded-[10px]` | 10px |
| Border width | `border-2` | `border-2` | 2px |
| **TeamButton** |
| Ancho | `w-9` (36px) | `w-9` (36px) | Igual |
| Bandera | `w-5 h-5` (20×20px) | `w-5 h-5` | Igual |
| Gap interno | `gap-2` (8px) | `gap-2` | Igual |
| Código tamaño | `text-[10px]` | `text-[10px]` | Igual |
| **Contenedores** |
| Padding principal | `p-8` (32px) | `py-8 px-2` | 32px vertical, 8px horizontal |
| Gap columnas | `gap-16` (64px) | N/A | - |
| **Octavos** |
| Layout | Vertical (justify-around) | Grid 4 columnas | - |
| Gap | Automático | `gap-2` (8px) | - |
| Max width | N/A | `max-w-md` (448px) | - |
| **Cuartos** |
| Layout | Vertical (justify-around) | Grid 2 columnas | - |
| Gap | Automático | `gap-8` (32px) | - |
| Max width | N/A | `max-w-sm` (384px) | - |
| **Conectores** |
| Octavos height | 130px | 60px | - |
| Octavos width | 40px | 40px | - |
| Cuartos height | 308px | 80px | - |
| Cuartos width | 40px | 60px | - |
| Semifinales height | 520px | 32px (línea CSS) | - |
| Semifinales width | 40px | 2px (línea CSS) | - |
| **Labels** |
| Posición | `-top-7` (28px arriba) | `-top-7` | Igual |
| Padding | `px-2 py-1` | `px-2 py-1` | Igual |
| Tamaño texto | `text-[10px]` | `text-[10px]` | Igual |

---

## 🎯 Z-Index Layers

```typescript
const Z_INDEX = {
  connectors: 0,           // SVG conectores (por defecto, detrás)
  matchCard: 1,            // z-[1] - MatchBox
  label: 10,               // z-10 - Labels (FINAL, BRONCE)
};
```

---

## 📱 Breakpoints Responsive

```typescript
const BREAKPOINTS = {
  mobile: '< 1024px',      // lg:hidden
  desktop: '≥ 1024px',     // hidden lg:block
};
```

**Reglas:**
- Desktop: `hidden lg:block` - Solo visible ≥1024px
- Mobile: `lg:hidden` - Solo visible <1024px

---

## 🔄 Flujo de Renderizado

### Desktop
```
Contenedor (p-8, gradient)
  └── Centrador (flex justify-center, min-w-[1200px], py-12)
       └── Layout Principal (flex gap-16)
            ├── IZQUIERDA (flex gap-16)
            │    ├── Octavos (flex-col, justify-around, height:672px)
            │    ├── Cuartos (flex-col, justify-around, height:672px)
            │    └── Semifinal (flex items-center, height:672px)
            │
            ├── CENTRO (flex-col, gap-8, px-8, height:672px)
            │    ├── Campeón (TrophyWithFlag lg)
            │    ├── Final (MatchBox con label)
            │    └── Bronce (MatchBox con label)
            │
            └── DERECHA (flex gap-16)
                 ├── Semifinal (flex items-center, height:672px)
                 ├── Cuartos (flex-col, justify-around, height:672px)
                 └── Octavos (flex-col, justify-around, height:672px)
```

### Mobile
```
Contenedor (gradient)
  └── Grid (place-items-center, py-8 px-2, gap-8)
       ├── Octavos Superior (grid-cols-4, gap-2, max-w-md)
       ├── Cuartos Superior (grid-cols-2, gap-8, max-w-sm)
       ├── Semifinal 1 (con conector hacia abajo)
       ├── Fila Final (grid-cols-3: Bronce | Final | Campeón)
       ├── Semifinal 2 (con conector hacia arriba)
       ├── Cuartos Inferior (grid-cols-2, gap-8, max-w-sm)
       └── Octavos Inferior (grid-cols-4, gap-2, max-w-md)
```

---

## ✅ Checklist de Implementación Exacta

Para replicar el bracket tal cual:

### Desktop
- [ ] Contenedor: `p-8`, `overflow-x-auto`, gradiente
- [ ] Centrador: `min-w-[1200px]`, `py-12`
- [ ] Layout principal: `flex gap-16`
- [ ] Altura columnas: `672px` (matchHeight * 4 + 48 * 3)
- [ ] MatchBox: `w-20 h-20`, `p-2`, `rounded-[10px]`, `border-2`
- [ ] TeamButton: `w-9`, `gap-2`, bandera `w-5 h-5`
- [ ] Conectores octavos: `height={130}`, `width={40}`
- [ ] Conectores cuartos: `height={308}`, `width={40}`
- [ ] Conectores semifinales: `height={520}`, `width={40}`, `type="semifinal"`
- [ ] Centro: `gap-8`, `px-8`
- [ ] Labels: `-top-7`, `px-2 py-1`, `text-[10px]`, `bg-yellow-400`

### Mobile
- [ ] Contenedor: `py-8 px-2`, gradiente
- [ ] Grid principal: `gap-8`
- [ ] Octavos: `grid-cols-4`, `gap-2`, `max-w-md`
- [ ] Cuartos: `grid-cols-2`, `gap-8`, `max-w-sm`
- [ ] Fila final: `grid-cols-3`, `gap-4`, `max-w-md`
- [ ] Conectores octavos: `height={60}`, `width={40}`, `direction="down"/"up"`
- [ ] Conectores cuartos: `height={80}`, `width={60}`, `direction="down"/"up"`
- [ ] Conectores semifinales: Línea CSS `w-0.5 h-8 bg-gray-400`
- [ ] TrophyWithFlag: `size="sm"` (vs `"lg"` en desktop)

---

**Versión:** 1.0 - Implementación Exacta  
**Última actualización:** 2026-02-12  
**Archivo fuente:** `/src/app/components/BracketViewEnhanced.tsx`  
**Uso:** Replicar bracket EXACTAMENTE como está implementado
