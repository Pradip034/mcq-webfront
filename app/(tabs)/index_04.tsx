import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
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

const API_URL = 'https://backend-02-zbm8.onrender.com/api';

const DEFAULT_STETHOSCOPE_IMAGE = 'https://img.icons8.com/color/96/stethoscope.png';

// Standard warning / alert sound URL
const DANGER_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

interface Option {
  text: string;
  image?: string;
}

interface Question {
  id: number;
  question: string;
  options: Option[];
  correctOption: number;
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

  // Refs to prevent stale closure references
  const currentIndexRef = useRef(currentIndex);
  const questionsRef = useRef(questions);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  useEffect(() => {
    fetchQuestions();
  }, []);

  // Stop text-to-speech when question changes
  useEffect(() => {
    Speech.stop();
    setIsSpeaking(false);
    setSpeakingOptionIndex(null);
  }, [currentIndex]);

  // Robust Timer Hook (Prevents duplicate intervals and question skips)
  useEffect(() => {
    if (loading || result || questions.length === 0) return;

    setTimeLeft(30);

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          
          const currentIdx = currentIndexRef.current;
          const totalQuestions = questionsRef.current.length;

          if (currentIdx < totalQuestions - 1) {
            setCurrentIndex(currentIdx + 1);
          } else {
            handleSubmit();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentIndex, loading, result, questions.length]);

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

  // Helper function to play danger sound on wrong answer
  const playDangerSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: DANGER_SOUND_URL },
        { shouldPlay: true }
      );
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.error('Failed to play danger sound:', error);
    }
  };

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
      Speech.speak(`Option ${index + 1}: ${optionText}`, {
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

  const handleSelectOption = (optionIndex: number) => {
    const currentQ = questions[currentIndex];

    // Stop ongoing question/option reading before playing selection voice/audio
    Speech.stop();
    setIsSpeaking(false);
    setSpeakingOptionIndex(null);

    if (currentQ.correctOption !== undefined) {
      if (optionIndex === currentQ.correctOption) {
        // Voice out "Right answer selected" for correct choices
        Speech.speak('Right answer selected', {
          language: 'en-US',
          pitch: 1.0,
          rate: 1.0,
        });
      } else {
        // Play alert audio for wrong choices
        playDangerSound();
      }
    }

    setUserAnswers((prev) => {
      const existingIndex = prev.findIndex((a) => a.id === currentQ.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].selectedOption = optionIndex;
        return updated;
      } else {
        return [...prev, { id: currentQ.id, selectedOption: optionIndex }];
      }
    });
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const calculateLiveScore = () => {
    let score = 0;
    userAnswers.forEach((ans) => {
      const question = questions.find((q) => q.id === ans.id);
      if (question && question.correctOption !== undefined) {
        if (ans.selectedOption === question.correctOption) {
          score += 4;
        } else {
          score -= 1;
        }
      }
    });
    return score;
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
    const message = `🎯 NEET Practice Test Result:\nScore: ${result.score}/${result.maxScore}\n✅ Correct: ${result.correctCount}\n❌ Incorrect: ${result.incorrectCount}\n⚪ Unattempted: ${result.unattemptedCount}`;
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;

    Linking.canOpenURL(whatsappUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(whatsappUrl);
        } else {
          Alert.alert('WhatsApp is not installed on your device.');
        }
      })
      .catch((err) => console.error('Error sharing to WhatsApp:', err));
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

  // ================= RESULTS VIEW =================
  if (result) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.headerText}>NEET Practice Result</Text>
            
            <Text style={styles.scoreText}>
              Your Score: {result.score} / {result.maxScore}
            </Text>

            <View style={styles.statsRow}>
              <View style={[styles.statBadge, { backgroundColor: '#15803D' }]}>
                <Text style={styles.statBadgeText}>✅ Correct: {result.correctCount}</Text>
              </View>
              <View style={[styles.statBadge, { backgroundColor: '#B91C1C' }]}>
                <Text style={styles.statBadgeText}>❌ Wrong: {result.incorrectCount}</Text>
              </View>
              <View style={[styles.statBadge, { backgroundColor: '#3F3F46' }]}>
                <Text style={styles.statBadgeText}>⚪ Skipped: {result.unattemptedCount}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.whatsappButton} onPress={shareOnWhatsApp} activeOpacity={0.7}>
              <Text style={styles.buttonText}>Share Score on WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.submitButton, { marginTop: 10 }]} onPress={restartQuiz} activeOpacity={0.7}>
              <Text style={styles.buttonText}>Restart Quiz</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Question Summary</Text>
            {questions.map((q, qIndex) => {
              const res = result.results?.find((r: any) => r.id === q.id);
              const userSelected = res?.selectedOption;
              const correctIdx = q.correctOption;

              return (
                <View key={q.id} style={styles.summaryCard}>
                  <Text style={styles.summaryQuestionText}>
                    {qIndex + 1}. {q.question}
                  </Text>
                  
                  {q.options.map((opt, optIndex) => {
                    const isCorrect = optIndex === correctIdx;
                    const isUserChoice = optIndex === userSelected;

                    let optionStyle = styles.resultOptionDefault;
                    if (isCorrect) {
                      optionStyle = styles.resultOptionCorrect;
                    } else if (isUserChoice && !isCorrect) {
                      optionStyle = styles.resultOptionWrong;
                    }

                    return (
                      <View key={optIndex} style={[styles.resultOptionBase, optionStyle]}>
                        <Text style={styles.resultOptionText}>
                          {optIndex + 1}. {opt.text}
                        </Text>
                        {isCorrect && <Text style={styles.badgeLabel}>✓ Correct</Text>}
                        {isUserChoice && !isCorrect && <Text style={styles.badgeLabel}>✗ Your Answer</Text>}
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ================= QUIZ VIEW =================
  const currentQ = questions[currentIndex];
  const selectedForCurrent = userAnswers.find(a => a.id === currentQ?.id)?.selectedOption;
  const currentLiveScore = calculateLiveScore();
  const maxPossibleScore = questions.length * 4;

  return (
    <SafeAreaView style={styles.container}>
      {questions.length > 0 && currentQ && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.topHeader}>
              <Text style={styles.progressText}>
                Q{currentIndex + 1}/{questions.length}
              </Text>
              
              <View style={styles.badgesContainer}>
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreBadgeText}>
                    Score: {currentLiveScore >= 0 ? `+${currentLiveScore}` : currentLiveScore} / {maxPossibleScore}
                  </Text>
                </View>

                <View style={styles.timerBadge}>
                  <Text style={styles.timerText}>⏳ {timeLeft}s</Text>
                </View>
              </View>
            </View>

            <View style={styles.questionHeader}>
              <Text style={styles.questionText}>{currentQ.question}</Text>
              <TouchableOpacity
                style={[
                  styles.audioButton, 
                  isSpeaking && speakingOptionIndex === null && styles.audioButtonActive
                ]}
                onPress={() => speakQuestion(currentQ.question)}
                activeOpacity={0.7}
              >
                <Text style={styles.audioButtonText}>
                  {isSpeaking && speakingOptionIndex === null ? '🛑' : '🔊'}
                </Text>
              </TouchableOpacity>
            </View>

            {currentQ.options.map((option: Option, index: number) => {
              const isSelected = selectedForCurrent === index;
              const isCorrectAnswer = index === currentQ.correctOption;
              const isOptionSpeaking = isSpeaking && speakingOptionIndex === index;

              let cardStyle = styles.optionCard;
              if (selectedForCurrent !== undefined) {
                if (isCorrectAnswer) {
                  cardStyle = styles.correctOptionCard;
                } else if (isSelected) {
                  cardStyle = styles.wrongOptionCard;
                }
              }

              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.optionCardBase, cardStyle]}
                  onPress={() => handleSelectOption(index)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: option.image || DEFAULT_STETHOSCOPE_IMAGE }}
                    style={styles.optionImage}
                  />
                  <Text style={styles.optionText}>
                    {index + 1}. {option.text}
                  </Text>
                  
                  <TouchableOpacity
                    style={[styles.optionAudioButton, isOptionSpeaking && styles.audioButtonActive]}
                    onPress={(e) => {
                      e.stopPropagation();
                      speakOption(index, option.text);
                    }}
                    activeOpacity={0.7}
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
                <TouchableOpacity 
                  style={styles.secondaryButton} 
                  onPress={handlePrevious}
                  activeOpacity={0.7}
                >
                  <Text style={styles.buttonText}>Back</Text>
                </TouchableOpacity>
              )}

              {currentIndex < questions.length - 1 ? (
                <TouchableOpacity 
                  style={styles.nextButton} 
                  onPress={handleNext}
                  activeOpacity={0.7}
                >
                  <Text style={styles.buttonText}>Next</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.submitButton} 
                  onPress={handleSubmit}
                  activeOpacity={0.7}
                >
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
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 16 },
  card: { backgroundColor: '#121212', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#27272A' },
  topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  progressText: { fontSize: 14, color: '#FF4D4D', fontWeight: 'bold' },
  
  badgesContainer: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  scoreBadge: { backgroundColor: '#1E293B', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: '#334155' },
  scoreBadgeText: { color: '#38BDF8', fontWeight: 'bold', fontSize: 12 },
  timerBadge: { backgroundColor: '#B91C1C', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  timerText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  
  questionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 10 },
  questionText: { flex: 1, fontSize: 18, fontWeight: 'bold', color: '#FFFFFF', lineHeight: 26 },
  audioButton: { backgroundColor: '#27272A', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3F3F46' },
  audioButtonActive: { backgroundColor: '#DC2626', borderColor: '#EF4444' },
  audioButtonText: { fontSize: 18 },

  optionCardBase: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1.5, marginBottom: 12 },
  optionCard: { backgroundColor: '#1E1E24', borderColor: '#27272A' },
  correctOptionCard: { backgroundColor: '#15803D', borderColor: '#22C55E' },
  wrongOptionCard: { backgroundColor: '#991B1B', borderColor: '#EF4444' },
  
  optionImage: { width: 36, height: 36, borderRadius: 6, marginRight: 12 },
  optionText: { fontSize: 15, color: '#FFFFFF', fontWeight: 'bold', flex: 1 },
  optionAudioButton: { backgroundColor: '#27272A', width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3F3F46', marginLeft: 8 },
  optionAudioText: { fontSize: 14 },

  headerText: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', textAlign: 'center', marginBottom: 12 },
  scoreText: { fontSize: 22, textAlign: 'center', marginBottom: 16, color: '#38BDF8', fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16, flexWrap: 'wrap', gap: 6 },
  statBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statBadgeText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF', marginTop: 20, marginBottom: 12 },
  
  summaryCard: { backgroundColor: '#18181B', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#27272A' },
  summaryQuestionText: { fontSize: 15, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8 },
  resultOptionBase: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, borderRadius: 6, marginBottom: 6 },
  resultOptionDefault: { backgroundColor: '#27272A' },
  resultOptionCorrect: { backgroundColor: '#15803D' },
  resultOptionWrong: { backgroundColor: '#991B1B' },
  resultOptionText: { color: '#FFFFFF', fontSize: 14, flex: 1 },
  badgeLabel: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },

  navRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, gap: 12 },
  nextButton: { backgroundColor: '#2563EB', padding: 14, borderRadius: 10, alignItems: 'center', flex: 1 },
  submitButton: { backgroundColor: '#16A34A', padding: 14, borderRadius: 10, alignItems: 'center', flex: 1 },
  whatsappButton: { backgroundColor: '#25D366', padding: 14, borderRadius: 10, alignItems: 'center' },
  secondaryButton: { backgroundColor: '#27272A', padding: 14, borderRadius: 10, alignItems: 'center', flex: 1 },
  buttonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 }
});