# Melodix 🎹

**Melodix** est un générateur d'instrumentales complètes basé sur une composition MIDI structurée.

## Ce que fait maintenant Melodix

- 🎧 **Référence audio optionnelle** : tu peux générer sans importer de morceau.
- 🧠 **Inspiration intelligente** : analyse locale du tempo, de l'énergie et de la texture de la référence pour influencer la composition.
- 🎼 **Composition musicale structurée** : progression d'accords, motifs réutilisés et variations, call/response et densité par section.
- 🥁 **Arrangement complet** : intro, couplets, refrains, outro, drums, bass/808, chords, melody, counter melody et arp/texture.
- 🎹 **MIDI multi-track** : chaque instrument est exportable séparément + un MIDI complet.
- 🔊 **Preview avec instruments échantillonnés** : le lecteur utilise des SoundFonts General MIDI plutôt que de simples oscillateurs.
- 📦 **ZIP automatique** : récupère tous les MIDI en une seule archive.
- 🖥️ Fonctionne côté navigateur, sans API IA payante.

## Inspiration audio

La référence reste une **source d'inspiration**, pas une copie. Melodix extrait des caractéristiques générales du fichier audio local (tempo approximatif, énergie et texture), puis les combine avec le style, l'ambiance, la seed et le moteur de composition.

## Export

Après chaque génération, tu peux récupérer :

- melodix-instrumentale-full.mid
- melodix-drums.mid
- melodix-bass.mid
- melodix-chords.mid
- melodix-melody.mid
- melodix-counter.mid
- melodix-arp.mid
- melodix-midi-pack.zip

Les MIDI sont adaptés à FL Studio, Ableton Live, Reaper et autres DAW compatibles MIDI.

## Moteur audio

Le preview s'appuie sur Tone.js et soundfont-player, avec des instruments échantillonnés General MIDI. Le téléchargement MIDI reste indépendant du moteur audio.

## Utilisation

Ouvre index.html dans un navigateur moderne ou déploie le dépôt avec GitHub Pages.

## Roadmap

- [ ] vraie détection de tonalité/chords par analyse harmonique
- [ ] analyse audio plus poussée (sections, onset, spectre)
- [ ] davantage de SoundFonts et instruments spécialisés
- [ ] moteur IA local optionnel
- [ ] intégration Ollama
- [ ] rendu WAV/MP3 local
- [ ] projets sauvegardables

## Licence

MIT — Reqeuss
