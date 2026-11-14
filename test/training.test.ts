// Training questions: Huly's data shapes (questions-resources) built from plain input, checked up front.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { questionDoc } from '../src/tools/training'

test('training questions: single, multiple and ordering in Huly\'s shapes; no correct answer = not scored', () => {
  assert.deepEqual(questionDoc({ type: 'single', title: 'Exit?', options: ['Left', 'Right'], correct: 'right' }, 1),
    { _class: 'questions:class:SingleChoiceAssessment', data: { title: 'Exit?', questionData: { options: [{ label: 'Left' }, { label: 'Right' }] }, assessmentData: { correctIndex: 1 } } })
  assert.deepEqual(questionDoc({ type: 'multiple', title: 'M', options: ['a', 'b', 'c'], correct: [3, 'a'] }, 1).data.assessmentData, { correctIndices: [0, 2] })
  // Ordering: correct = options in the right order; Huly stores the 1-based position of each option.
  assert.deepEqual(questionDoc({ type: 'ordering', title: 'O', options: ['Call', 'Leave', 'Alarm'], correct: ['Alarm', 'Leave', 'Call'] }, 1).data.assessmentData, { correctOrder: [3, 2, 1] })
  assert.equal(questionDoc({ type: 'single', title: 'Feedback', options: ['Good', 'Bad'] }, 1)._class, 'questions:class:SingleChoiceQuestion')
})

test('training questions: mistakes are refused with the question and the reason', () => {
  assert.throws(() => questionDoc({ type: 'single', title: 'Q', options: ['a', 'b'], correct: 3 }, 2), /Question 2 \("Q"\): correct answer '3' is not one of the options/)
  assert.throws(() => questionDoc({ type: 'single', title: 'Q', options: ['a', 'b'], correct: ['a', 'b'] }, 1), /exactly one correct answer/)
  assert.throws(() => questionDoc({ type: 'ordering', title: 'Q', options: ['a', 'b', 'c'], correct: ['a', 'b'] }, 1), /list every option once/)
  assert.throws(() => questionDoc({ type: 'multiple', title: 'Q', options: ['a'], correct: 1 }, 1), /at least two options/)
})
