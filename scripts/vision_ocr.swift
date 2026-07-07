import AppKit
import Foundation
import Vision

struct OcrOutput: Encodable {
    let text: String
    let average_confidence: Double
}

enum OcrError: Error {
    case missingArgument
    case unreadableImage
}

func run() throws {
    guard CommandLine.arguments.count >= 2 else {
        throw OcrError.missingArgument
    }

    let imagePath = CommandLine.arguments[1]
    let imageUrl = URL(fileURLWithPath: imagePath)
    guard let image = NSImage(contentsOf: imageUrl) else {
        throw OcrError.unreadableImage
    }

    var imageRect = NSRect(origin: .zero, size: image.size)
    guard let cgImage = image.cgImage(forProposedRect: &imageRect, context: nil, hints: nil) else {
        throw OcrError.unreadableImage
    }

    var recognizedLines: [String] = []
    var confidenceSum = 0.0
    var confidenceCount = 0.0

    let request = VNRecognizeTextRequest { request, error in
        guard error == nil else { return }
        guard let observations = request.results as? [VNRecognizedTextObservation] else { return }

        for observation in observations {
            guard let candidate = observation.topCandidates(1).first else { continue }
            let line = candidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !line.isEmpty else { continue }
            recognizedLines.append(line)
            confidenceSum += Double(candidate.confidence)
            confidenceCount += 1.0
        }
    }

    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.minimumTextHeight = 0.01

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try handler.perform([request])

    let text = recognizedLines.joined(separator: "\n")
    let averageConfidence = confidenceCount > 0 ? confidenceSum / confidenceCount : 0
    let output = OcrOutput(text: text, average_confidence: averageConfidence)
    let data = try JSONEncoder().encode(output)
    FileHandle.standardOutput.write(data)
}

do {
    try run()
} catch {
    FileHandle.standardError.write(Data(String(describing: error).utf8))
    exit(1)
}
