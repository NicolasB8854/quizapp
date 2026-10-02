// Tests arbeiten mit dem mitgelieferten Katalog — synchron gesetzt, damit
// Reducer-Tests nicht auf den lazy Chunk warten müssen.
import { setQuestionCatalog, type Question } from './packages/shared/src'
import questions from './packages/shared/src/data/questions.json'

setQuestionCatalog(questions as unknown as Question[])
