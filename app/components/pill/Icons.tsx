import { motion } from 'framer-motion'
import itoLogo from '@/app/assets/ito-logo-1024.png'

interface ItoLogoProps {
  className?: string
}

export const ItoLogo = ({ className = 'w-6 h-6' }: ItoLogoProps) => {
  return (
    <img
      src={itoLogo}
      alt="Ito"
      className={className}
      style={{ objectFit: 'contain' }}
    />
  )
}

interface WaveformIconProps {
  isLight?: boolean
  volumeHistory?: number[]
}

const BAR_COUNT = 5

export const WaveformIcon = ({
  isLight = false,
  volumeHistory = [],
}: WaveformIconProps) => {
  const barColor = isLight ? 'bg-zinc-600' : 'bg-white'

  const getBarHeight = (index: number): number => {
    const baseHeights = [10, 16, 20, 16, 10]
    if (volumeHistory.length > 0) {
      const vol = volumeHistory[volumeHistory.length - 1 - index] || 0
      const scale = Math.max(0.4, Math.min(1, vol * 10 + 0.4))
      return baseHeights[index] * scale
    }
    return baseHeights[index]
  }

  return (
    <div className="flex items-center gap-[3px] h-5">
      {Array.from({ length: BAR_COUNT }).map((_, index) => (
        <motion.div
          key={index}
          className={`w-[3px] rounded-full ${barColor}`}
          animate={{
            height: [
              getBarHeight(index) * 0.5,
              getBarHeight(index),
              getBarHeight(index) * 0.6,
              getBarHeight(index) * 0.9,
              getBarHeight(index) * 0.5,
            ],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'easeInOut',
            delay: index * 0.1,
          }}
          style={{
            minHeight: 8,
            maxHeight: 20,
          }}
        />
      ))}
    </div>
  )
}
