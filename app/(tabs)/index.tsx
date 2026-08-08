import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

////const API_URL = 'http://10.117.181.86:5000/api';
const API_URL = 'https://mcq-backend-6yod.onrender.com';
const DEFAULT_STETHOSCOPE_IMAGE = 'https://img.icons8.com/color/96/stethoscope.png';

interface Option {
  text: string;
  image?: string;
}

interface Question {
  id: number;
  question: string;
  options: Option[];
}

export default function Index() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingOptionIndex, setSpeakingOptionIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchQuestions();
  }, []);

  // Stop speech synthesis whenever changing questions or unmounting
  useEffect(() => {
    Speech.stop();
    setIsSpeaking(false);
    setSpeakingOptionIndex(null);
  }, [currentIndex]);

  // 30-second timer logic per question
  useEffect(() => {
    if (loading || result || questions.length === 0) return;

    setTimeLeft(30);

    const timer = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(timer);
          handleTimeOut();
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentIndex, loading, result, questions]);

  const speakQuestion = (text: string) => {
    if (isSpeaking && speakingOptionIndex === null) {
      Speech.stop();
      setIsSpeaking(false);
    } else {
      Speech.stop();
      setIsSpeaking(true);
      setSpeakingOptionIndex(null);
      Speech.speak(text, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9,
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    }
  };

  const speakOption = (index: number, optionText: string) => {
    if (isSpeaking && speakingOptionIndex === index) {
      Speech.stop();
      setIsSpeaking(false);
      setSpeakingOptionIndex(null);
    } else {
      Speech.stop();
      setIsSpeaking(true);
      setSpeakingOptionIndex(index);
      const textToSpeak = `Option ${index + 1}: ${optionText}`;
      Speech.speak(textToSpeak, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9,
        onDone: () => {
          setIsSpeaking(false);
          setSpeakingOptionIndex(null);
        },
        onStopped: () => {
          setIsSpeaking(false);
          setSpeakingOptionIndex(null);
        },
        onError: () => {
          setIsSpeaking(false);
          setSpeakingOptionIndex(null);
        },
      });
    }
  };

  const handleTimeOut = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const fetchQuestions = async () => {
    try {
      const response = await fetch(`${API_URL}/questions`);
      const data = await response.json();
      setQuestions(data);
    } catch (error) {
      console.error("Error fetching questions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (optionIndex: number) => {
    const currentQ = questions[currentIndex];
    const existingIndex = userAnswers.findIndex(a => a.id === currentQ.id);
    let updatedAnswers = [...userAnswers];

    if (existingIndex > -1) {
      updatedAnswers[existingIndex].selectedOption = optionIndex;
    } else {
      updatedAnswers.push({ id: currentQ.id, selectedOption: optionIndex });
    }

    setUserAnswers(updatedAnswers);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    Speech.stop();
    try {
      const response = await fetch(`${API_URL}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: userAnswers })
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error("Error submitting answers:", error);
    } finally {
      setLoading(false);
    }
  };

  const shareOnWhatsApp = () => {
    if (!result) return;
    const message = `🎯 NEET MCQ Practice Test Result:\nI scored ${result.score} out of ${result.total}! 💪`;
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;

    Linking.canOpenURL(whatsappUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(whatsappUrl);
        } else {
          Alert.alert('WhatsApp is not installed on your device.');
        }
      })
      .catch((err) => console.error('An error occurred sharing to WhatsApp:', err));
  };

  const restartQuiz = () => {
    setUserAnswers([]);
    setCurrentIndex(0);
    setResult(null);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF3B30" />
      </View>
    );
  }

  if (result) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.headerText}>NEET Practice Result</Text>
          <Text style={styles.scoreText}>
            Your Score: {result.score} / {result.total}
          </Text>

          <TouchableOpacity style={styles.whatsappButton} onPress={shareOnWhatsApp}>
            <Text style={styles.buttonText}>Share Score on WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.submitButton, { marginTop: 12 }]} onPress={restartQuiz}>
            <Text style={styles.buttonText}>Restart Quiz</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentQ = questions[currentIndex];
  const selectedForCurrent = userAnswers.find(a => a.id === currentQ?.id)?.selectedOption;

  return (
    <SafeAreaView style={styles.container}>
      {questions.length > 0 && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.topHeader}>
              <Text style={styles.progressText}>
                NEET MCQ - Question {currentIndex + 1} of {questions.length}
              </Text>
              <View style={styles.timerBadge}>
                <Text style={styles.timerText}>⏳ {timeLeft}s</Text>
              </View>
            </View>

            {/* Question Header with Audio Button */}
            <View style={styles.questionHeader}>
              <Text style={styles.questionText}>{currentQ.question}</Text>
              <TouchableOpacity
                style={[
                  styles.audioButton, 
                  isSpeaking && speakingOptionIndex === null && styles.audioButtonActive
                ]}
                onPress={() => speakQuestion(currentQ.question)}
              >
                <Text style={styles.audioButtonText}>
                  {isSpeaking && speakingOptionIndex === null ? '🛑' : '🔊'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Options List with Individual Audio Buttons */}
            {currentQ.options.map((option: Option, index: number) => {
              const isSelected = selectedForCurrent === index;
              const isOptionSpeaking = isSpeaking && speakingOptionIndex === index;

              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.optionCard, isSelected && styles.selectedOptionCard]}
                  onPress={() => handleSelectOption(index)}
                >
                  <Image
                    source={{ uri: option.image || DEFAULT_STETHOSCOPE_IMAGE }}
                    style={styles.optionImage}
                  />
                  <Text style={[styles.optionText, isSelected && styles.selectedOptionText]}>
                    {index + 1}. {option.text}
                  </Text>
                  
                  {/* Dedicated Speaker Button for each Option */}
                  <TouchableOpacity
                    style={[styles.optionAudioButton, isOptionSpeaking && styles.audioButtonActive]}
                    onPress={() => speakOption(index, option.text)}
                  >
                    <Text style={styles.optionAudioText}>
                      {isOptionSpeaking ? '🛑' : '🔊'}
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}

            <View style={styles.navRow}>
              {currentIndex > 0 && (
                <TouchableOpacity style={styles.secondaryButton} onPress={handlePrevious}>
                  <Text style={styles.buttonText}>Back</Text>
                </TouchableOpacity>
              )}

              {currentIndex < questions.length - 1 ? (
                <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                  <Text style={styles.buttonText}>Next</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                  <Text style={styles.buttonText}>Submit Test</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  centered: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#121212', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#27272A' },
  topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  progressText: { fontSize: 14, color: '#FF4D4D', fontWeight: 'bold' },
  timerBadge: { backgroundColor: '#B91C1C', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  timerText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  
  // Question Header & Main Audio Button
  questionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 10 },
  questionText: { flex: 1, fontSize: 20, fontWeight: 'bold', color: '#FFFFFF', lineHeight: 28 },
  audioButton: {
    backgroundColor: '#27272A',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center', // Fixed property name
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3F3F46'
  },
  audioButtonActive: {
    backgroundColor: '#DC2626',
    borderColor: '#EF4444'
  },
  audioButtonText: { fontSize: 20 },

  // Option Card & Option Audio Button
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#7F1D1D',
    marginBottom: 12,
    backgroundColor: '#450A0A'
  },
  selectedOptionCard: { backgroundColor: '#DC2626', borderColor: '#EF4444' },
  optionImage: { width: 40, height: 40, borderRadius: 6, marginRight: 14 },
  optionText: { fontSize: 16, color: '#FFFFFF', fontWeight: 'bold', flex: 1 },
  selectedOptionText: { color: '#FFFFFF', fontWeight: 'bold' },
  
  optionAudioButton: {
    backgroundColor: '#27272A',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3F3F46',
    marginLeft: 8
  },
  optionAudioText: { fontSize: 16 },

  navRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, gap: 12 },
  nextButton: { backgroundColor: '#2563EB', padding: 16, borderRadius: 10, alignItems: 'center', flex: 1 },
  submitButton: { backgroundColor: '#16A34A', padding: 16, borderRadius: 10, alignItems: 'center', flex: 1 },
  whatsappButton: { backgroundColor: '#25D366', padding: 16, borderRadius: 10, alignItems: 'center' },
  secondaryButton: { backgroundColor: '#27272A', padding: 16, borderRadius: 10, alignItems: 'center', flex: 1 },
  buttonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
  headerText: { fontSize: 26, fontWeight: 'bold', color: '#FFFFFF', textAlign: 'center', marginBottom: 16 },
  scoreText: { fontSize: 22, textAlign: 'center', marginBottom: 28, color: '#FF4D4D', fontWeight: 'bold' }
});