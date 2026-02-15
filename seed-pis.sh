#!/bin/bash
# Seed Firebase with Paris neuroscience PIs
# Usage: bash seed-pis.sh <ADMIN_EMAIL> <ADMIN_PASSWORD>
#
# This script adds ~60 PIs to the Firestore database.
# It also creates institute entries for each unique institute.

set -e

ADMIN_EMAIL="${1:?Usage: bash seed-pis.sh <ADMIN_EMAIL> <ADMIN_PASSWORD>}"
ADMIN_PASSWORD="${2:?Please provide admin password}"
PROJECT_ID="compneuroparis"

API_KEY=$(python3 -c "
import re
with open('js/firebase-config.js') as f:
    content = f.read()
m = re.search(r'apiKey:\s*\"([^\"]+)\"', content)
if m: print(m.group(1))
")

if [ -z "$API_KEY" ]; then
    echo "ERROR: Could not extract API key from js/firebase-config.js"
    exit 1
fi

echo "Authenticating..."
AUTH_RESPONSE=$(curl -s -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$API_KEY" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"returnSecureToken\":true}")

ID_TOKEN=$(echo "$AUTH_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('idToken',''))")
ADMIN_UID=$(echo "$AUTH_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('localId',''))")

if [ -z "$ID_TOKEN" ]; then
    echo "ERROR: Authentication failed."
    echo "$AUTH_RESPONSE"
    exit 1
fi

echo "Authenticated as $ADMIN_EMAIL (UID: $ADMIN_UID)"

FIRESTORE_URL="https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)/documents"
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Helper: create an institute (auto-approved)
create_institute() {
  local name="$1"
  local website="$2"
  curl -s -X POST \
    "$FIRESTORE_URL/institutes" \
    -H "Authorization: Bearer $ID_TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{
      \"fields\": {
        \"name\": {\"stringValue\": \"$name\"},
        \"status\": {\"stringValue\": \"approved\"},
        \"proposedBy\": {\"stringValue\": \"$ADMIN_UID\"},
        \"website\": {\"stringValue\": \"$website\"},
        \"createdAt\": {\"timestampValue\": \"$NOW\"}
      }
    }" > /dev/null 2>&1
  echo "  Institute: $name"
}

# Helper: create a PI/group
create_pi() {
  local name="$1"
  local keywords_json="$2"
  local summary="$3"
  local website_url="$4"
  local photo_url="$5"
  local subfields_json="$6"
  local institutes_json="$7"
  local first_subfield="$8"
  local first_institute="$9"

  curl -s -X POST \
    "$FIRESTORE_URL/groups" \
    -H "Authorization: Bearer $ID_TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{
      \"fields\": {
        \"name\": {\"stringValue\": $(echo "$name" | python3 -c "import json,sys; print(json.dumps(sys.stdin.read().strip()))")},
        \"keywords\": {\"arrayValue\": {\"values\": $keywords_json}},
        \"summary\": {\"stringValue\": $(echo "$summary" | python3 -c "import json,sys; print(json.dumps(sys.stdin.read().strip()))")},
        \"links\": {\"arrayValue\": {\"values\": [
          {\"mapValue\": {\"fields\": {
            \"label\": {\"stringValue\": \"Website\"},
            \"url\": {\"stringValue\": \"$website_url\"}
          }}}
        ]}},
        \"photoURL\": {\"stringValue\": \"$photo_url\"},
        \"subfields\": {\"arrayValue\": {\"values\": $subfields_json}},
        \"institutes\": {\"arrayValue\": {\"values\": $institutes_json}},
        \"subfield\": {\"stringValue\": \"$first_subfield\"},
        \"institute\": {\"stringValue\": \"$first_institute\"},
        \"creatorUid\": {\"stringValue\": \"$ADMIN_UID\"},
        \"createdAt\": {\"timestampValue\": \"$NOW\"},
        \"updatedAt\": {\"timestampValue\": \"$NOW\"}
      }
    }" > /dev/null 2>&1
  echo "  PI: $name"
}

echo ""
echo "=== Creating Institutes ==="
create_institute "ENS - Ecole Normale Superieure" "https://cognition.ens.fr/en"
create_institute "Paris Brain Institute (ICM)" "https://parisbraininstitute.org"
create_institute "Institut Pasteur" "https://research.pasteur.fr/en/department/neuroscience/"
create_institute "ESPCI Paris" "https://www.bio.espci.fr"
create_institute "College de France" "https://www.college-de-france.fr"
create_institute "CEA NeuroSpin" "https://joliot.cea.fr/drf/joliot/en/Pages/research_entities/NeuroSpin.aspx"
create_institute "NeuroPSI (Paris-Saclay)" "https://neuropsi.cnrs.fr/en/homepage/"
create_institute "INCC - Universite Paris Cite" "https://incc-paris.fr"
create_institute "ISIR - Sorbonne Universite" "https://www.isir.upmc.fr"
create_institute "Institut de la Vision" "https://www.institut-vision.org/en/"
create_institute "Institut de l'Audition" "https://www.institut-audition.fr/en"
create_institute "IPNP - Universite Paris Cite" "https://ipnp.paris5.inserm.fr"
create_institute "SPPIN - Universite Paris Cite" "https://www.sppin.fr"
create_institute "IBENS - ENS" "https://www.bio.ens.psl.eu"
create_institute "INRIA Paris" "https://www.inria.fr/en/centre-inria-de-paris"

echo ""
echo "=== Creating PIs ==="

# ==================== ENS - LNC2 ====================

create_pi "Boris Gutkin" \
  '[{"stringValue":"neural dynamics"},{"stringValue":"neuromodulation"},{"stringValue":"addiction"},{"stringValue":"motivated behavior"},{"stringValue":"machine learning"}]' \
  "Co-founder and director of the Group for Neural Theory at ENS. Models brain circuit dynamics, neuromodulation, and motivated behavior combining tools from statistical physics and dynamical systems." \
  "https://gnt.dec.ens.fr/en/member/636/boris-gutkin" \
  "https://lnc2.dec.ens.fr/sites/cognition.ens.fr/files/styles/300x300/public/pictures/2017-10/Boris_Gutkin.jpg" \
  '[{"stringValue":"computational"}]' \
  '[{"stringValue":"ENS - Ecole Normale Superieure"}]' \
  "computational" "ENS - Ecole Normale Superieure"

create_pi "Sophie Deneve" \
  '[{"stringValue":"neural coding"},{"stringValue":"Bayesian inference"},{"stringValue":"predictive coding"},{"stringValue":"spiking networks"},{"stringValue":"excitation-inhibition balance"}]' \
  "Develops theories of neural coding and computation, showing that biological neural networks implement efficient Bayesian inference. Specialist in balanced networks and circular inference." \
  "https://gnt.dec.ens.fr/en/member/628/sophie-deneve" \
  "https://gnt.dec.ens.fr/sites/cognition.ens.fr/files/styles/300x300/public/pictures/2017-10/sophie_crop.jpg" \
  '[{"stringValue":"computational"}]' \
  '[{"stringValue":"ENS - Ecole Normale Superieure"}]' \
  "computational" "ENS - Ecole Normale Superieure"

create_pi "Srdjan Ostojic" \
  '[{"stringValue":"recurrent neural networks"},{"stringValue":"low-rank networks"},{"stringValue":"neural dynamics"},{"stringValue":"population coding"},{"stringValue":"machine learning"}]' \
  "Studies how collective dynamics in recurrent neural networks implement computations underlying behavior. Developed low-rank RNN framework linking connectivity to dynamics." \
  "https://lnc2.dec.ens.fr/en/member/655/srdjan-ostojic" \
  "https://lnc2.dec.ens.fr/sites/cognition.ens.fr/files/styles/300x300/public/pictures/2017-10/srdjan.jpg" \
  '[{"stringValue":"computational"}]' \
  '[{"stringValue":"ENS - Ecole Normale Superieure"}]' \
  "computational" "ENS - Ecole Normale Superieure"

create_pi "Alex Cayco Gajic" \
  '[{"stringValue":"cerebellum"},{"stringValue":"motor learning"},{"stringValue":"dimensionality reduction"},{"stringValue":"neural population dynamics"},{"stringValue":"cortico-cerebellar interactions"}]' \
  "Studies how the cerebellum interacts with neocortex and basal ganglia for motor coordination and cognition. Develops computational approaches and dimensionality reduction methods for neural data." \
  "https://sites.google.com/view/caycogajic/home" \
  "https://caycogajiclab.github.io/img/portraits/alex.jpg" \
  '[{"stringValue":"computational"}]' \
  '[{"stringValue":"ENS - Ecole Normale Superieure"}]' \
  "computational" "ENS - Ecole Normale Superieure"

create_pi "Etienne Koechlin" \
  '[{"stringValue":"prefrontal cortex"},{"stringValue":"cognitive control"},{"stringValue":"decision-making"},{"stringValue":"executive function"},{"stringValue":"hierarchical control"}]' \
  "Studies how the human frontal cortex supports decision-making and cognitive control. Discovered hierarchical organization of the prefrontal cortex and its role in adaptive behavior." \
  "https://lnc2.dec.ens.fr/en/member/642/etienne-koechlin" \
  "" \
  '[{"stringValue":"computational"},{"stringValue":"human"}]' \
  '[{"stringValue":"ENS - Ecole Normale Superieure"}]' \
  "computational" "ENS - Ecole Normale Superieure"

create_pi "Valentin Wyart" \
  '[{"stringValue":"confidence"},{"stringValue":"decision-making under uncertainty"},{"stringValue":"Bayesian inference"},{"stringValue":"belief updating"},{"stringValue":"EEG"}]' \
  "Studies human decision-making under uncertainty. Discovered how confidence controls perceptual evidence accumulation. ERC Starting Grant winner." \
  "https://sites.google.com/site/valentinwyart/" \
  "https://lnc2.dec.ens.fr/sites/cognition.ens.fr/files/styles/300x300/public/pictures/2025-03/Valentin.jpg" \
  '[{"stringValue":"computational"},{"stringValue":"human"}]' \
  '[{"stringValue":"ENS - Ecole Normale Superieure"}]' \
  "computational" "ENS - Ecole Normale Superieure"

create_pi "Catherine Tallon-Baudry" \
  '[{"stringValue":"consciousness"},{"stringValue":"interoception"},{"stringValue":"visceral signals"},{"stringValue":"gut-brain coupling"},{"stringValue":"neural oscillations"}]' \
  "Studies how visceral (gut-brain) signals contribute to subjective experience and first-person perspective. ERC Advanced Grant recipient. CNRS Silver Medal 2021." \
  "https://sites.google.com/view/tallon-baudry-lab/home" \
  "https://lnc2.dec.ens.fr/sites/cognition.ens.fr/files/styles/300x300/public/pictures/2017-10/CTB2016.png" \
  '[{"stringValue":"human"}]' \
  '[{"stringValue":"ENS - Ecole Normale Superieure"}]' \
  "human" "ENS - Ecole Normale Superieure"

create_pi "Stefano Palminteri" \
  '[{"stringValue":"reinforcement learning"},{"stringValue":"reward"},{"stringValue":"punishment"},{"stringValue":"value-based decision-making"},{"stringValue":"computational psychiatry"}]' \
  "Leads the Human Reinforcement Learning team. Investigates how humans learn from rewards and punishments, with a focus on context-dependent outcome encoding." \
  "https://sites.google.com/site/stefanopalminteri/home" \
  "https://lnc2.dec.ens.fr/sites/cognition.ens.fr/files/styles/300x300/public/pictures/2019-08/stefano.jpg" \
  '[{"stringValue":"computational"},{"stringValue":"human"}]' \
  '[{"stringValue":"ENS - Ecole Normale Superieure"}]' \
  "computational" "ENS - Ecole Normale Superieure"

create_pi "Julie Grezes" \
  '[{"stringValue":"social cognition"},{"stringValue":"emotion"},{"stringValue":"body language"},{"stringValue":"action perception"},{"stringValue":"social neuroscience"}]' \
  "Leads the Social Cognition team studying the neural basis of social perception, emotional processing, and how the brain processes body language and social signals." \
  "https://sites.google.com/view/juliegrezes/home" \
  "https://lnc2.dec.ens.fr/sites/cognition.ens.fr/files/styles/300x300/public/pictures/2017-10/JG.png" \
  '[{"stringValue":"human"}]' \
  '[{"stringValue":"ENS - Ecole Normale Superieure"}]' \
  "human" "ENS - Ecole Normale Superieure"

create_pi "Coralie Chevallier" \
  '[{"stringValue":"social cognition"},{"stringValue":"autism"},{"stringValue":"behavioral science"},{"stringValue":"public policy"},{"stringValue":"social decision-making"}]' \
  "Research on social cognition, its development and its disruption in autism, applying behavioral science to public policy questions." \
  "https://sites.google.com/site/coraliechevallier/" \
  "https://lnc2.dec.ens.fr/sites/cognition.ens.fr/files/styles/300x300/public/pictures/2017-10/CC.png" \
  '[{"stringValue":"human"}]' \
  '[{"stringValue":"ENS - Ecole Normale Superieure"}]' \
  "human" "ENS - Ecole Normale Superieure"

# ==================== ENS - LSCP ====================

create_pi "Emmanuel Dupoux" \
  '[{"stringValue":"speech processing"},{"stringValue":"cognitive modeling"},{"stringValue":"machine learning"},{"stringValue":"language models"},{"stringValue":"zero-resource learning"}]' \
  "Develops machine-learning approaches to model cognitive processes, especially language and speech acquisition. Co-leads the CoML team at INRIA/ENS." \
  "http://www.lscp.net/persons/dupoux/" \
  "https://lscp.dec.ens.fr/sites/cognition.ens.fr/files/styles/300x300/public/pictures/2021-10/emmanuel_dupoux.png" \
  '[{"stringValue":"computational"},{"stringValue":"human"}]' \
  '[{"stringValue":"ENS - Ecole Normale Superieure"}]' \
  "computational" "ENS - Ecole Normale Superieure"

create_pi "Sid Kouider" \
  '[{"stringValue":"consciousness"},{"stringValue":"attention"},{"stringValue":"subliminal processing"},{"stringValue":"infant cognition"},{"stringValue":"neural correlates"}]' \
  "Studies consciousness and its neural correlates, including subliminal perception and the emergence of consciousness in infants. ERC Consolidator Grant recipient." \
  "https://sidkouider.com/" \
  "https://lscp.dec.ens.fr/sites/cognition.ens.fr/files/styles/300x300/public/pictures/2017-10/sid_kouider.jpg" \
  '[{"stringValue":"human"}]' \
  '[{"stringValue":"ENS - Ecole Normale Superieure"}]' \
  "human" "ENS - Ecole Normale Superieure"

create_pi "Franck Ramus" \
  '[{"stringValue":"dyslexia"},{"stringValue":"language disorders"},{"stringValue":"cognitive development"},{"stringValue":"genetics of cognition"},{"stringValue":"neurodevelopmental disorders"}]' \
  "Investigates the cognitive and genetic bases of language disorders and developmental disabilities, including dyslexia and autism." \
  "http://www.lscp.net/persons/ramus/en/" \
  "https://lscp.dec.ens.fr/sites/cognition.ens.fr/files/styles/300x300/public/pictures/2017-12/ramus_m%C3%A9decine_4_1.png" \
  '[{"stringValue":"human"}]' \
  '[{"stringValue":"ENS - Ecole Normale Superieure"}]' \
  "human" "ENS - Ecole Normale Superieure"

# ==================== ENS - LSP ====================

create_pi "Shihab Shamma" \
  '[{"stringValue":"auditory neuroscience"},{"stringValue":"speech perception"},{"stringValue":"music cognition"},{"stringValue":"neural coding"},{"stringValue":"cortical processing"}]' \
  "Studies auditory processing of speech and music. ERC Advanced Grant recipient for projects on adaptive auditory cognition and neuroplasticity." \
  "https://lsp.dec.ens.fr/en/member/667/shihab-shamma" \
  "https://faculty.eng.umd.edu/sites/faculty.eng.umd.edu/files/profile_images/sas.jpg" \
  '[{"stringValue":"systems"},{"stringValue":"computational"}]' \
  '[{"stringValue":"ENS - Ecole Normale Superieure"}]' \
  "systems" "ENS - Ecole Normale Superieure"

create_pi "Daniel Pressnitzer" \
  '[{"stringValue":"auditory perception"},{"stringValue":"psychoacoustics"},{"stringValue":"auditory scene analysis"},{"stringValue":"temporal processing"}]' \
  "Studies auditory perception, scene analysis, and how the brain parses complex sound environments." \
  "http://audition.ens.fr/dp/" \
  "https://lsp.dec.ens.fr/sites/cognition.ens.fr/files/styles/300x300/public/pictures/2017-09/DPRESSNITZER.jpg" \
  '[{"stringValue":"human"},{"stringValue":"computational"}]' \
  '[{"stringValue":"ENS - Ecole Normale Superieure"}]' \
  "human" "ENS - Ecole Normale Superieure"

create_pi "Pascal Mamassian" \
  '[{"stringValue":"visual perception"},{"stringValue":"perceptual confidence"},{"stringValue":"Bayesian perception"},{"stringValue":"sensory decision-making"}]' \
  "Director of LSP. Investigates visual perception and perceptual decision-making using Bayesian and psychophysical approaches." \
  "http://mamassian.free.fr/free/Home.html" \
  "https://lsp.dec.ens.fr/sites/cognition.ens.fr/files/styles/300x300/public/pictures/2017-10/PM.jpg" \
  '[{"stringValue":"human"},{"stringValue":"computational"}]' \
  '[{"stringValue":"ENS - Ecole Normale Superieure"}]' \
  "human" "ENS - Ecole Normale Superieure"

# ==================== ICM / Paris Brain Institute ====================

create_pi "Mathias Pessiglione" \
  '[{"stringValue":"motivation"},{"stringValue":"effort"},{"stringValue":"reward"},{"stringValue":"neuroeconomics"},{"stringValue":"computational neuroscience"}]' \
  "Co-heads the MBB (Motivation, Brain and Behaviour) team. Builds neuro-computational models of how the brain motivates behavior." \
  "https://sites.google.com/site/motivationbrainbehavior/" \
  "https://parisbraininstitute.org/sites/default/files/styles/max_325x325/public/2025-08/mathias-pessiglione.jpg" \
  '[{"stringValue":"computational"},{"stringValue":"human"}]' \
  '[{"stringValue":"Paris Brain Institute (ICM)"}]' \
  "computational" "Paris Brain Institute (ICM)"

create_pi "Jean Daunizeau" \
  '[{"stringValue":"Bayesian inference"},{"stringValue":"variational methods"},{"stringValue":"computational psychiatry"},{"stringValue":"decision-making"},{"stringValue":"VBA toolbox"}]' \
  "Co-heads MBB team. Develops Bayesian and variational approaches for computational neuroscience. Created the Hierarchical Gaussian Filter and variational Laplace methods." \
  "https://sites.google.com/site/jeandaunizeauswebsite/" \
  "https://parisbraininstitute.org/sites/default/files/styles/max_325x325/public/2024-07/13-30_Jean%20Daunizeau.jpg" \
  '[{"stringValue":"computational"}]' \
  '[{"stringValue":"Paris Brain Institute (ICM)"}]' \
  "computational" "Paris Brain Institute (ICM)"

create_pi "Lionel Naccache" \
  '[{"stringValue":"consciousness"},{"stringValue":"subliminal perception"},{"stringValue":"unconscious processing"},{"stringValue":"neuropsychology"},{"stringValue":"cognitive functions"}]' \
  "World specialist on consciousness, awarded by the French Academy of Sciences. Explores neural bases of consciousness and cognitive functions." \
  "https://parisbraininstitute.org/collaborators/naccache-lionel" \
  "https://parisbraininstitute.org/sites/default/files/styles/max_325x325/public/2024-07/13_30_Lionel_Naccache.jpg" \
  '[{"stringValue":"human"}]' \
  '[{"stringValue":"Paris Brain Institute (ICM)"}]' \
  "human" "Paris Brain Institute (ICM)"

create_pi "Paolo Bartolomeo" \
  '[{"stringValue":"spatial cognition"},{"stringValue":"hemispatial neglect"},{"stringValue":"attention"},{"stringValue":"visual awareness"},{"stringValue":"brain lesion studies"}]' \
  "Co-leads PICNIC Lab exploring the neural bases of spatial cognition and attention, particularly hemispatial neglect." \
  "https://www.paolobartolomeo.eu/" \
  "https://parisbraininstitute.org/sites/default/files/styles/max_325x325/public/2025-08/paolo-bartolomeo.jpg" \
  '[{"stringValue":"human"}]' \
  '[{"stringValue":"Paris Brain Institute (ICM)"}]' \
  "human" "Paris Brain Institute (ICM)"

create_pi "Julia Sliwa" \
  '[{"stringValue":"social neuroscience"},{"stringValue":"primate cognition"},{"stringValue":"fMRI"},{"stringValue":"neurophysiology"},{"stringValue":"theory of mind"}]' \
  "ERC Starting Grant recipient. Studies neural mechanisms enabling transformation of social percepts into social concepts using fMRI and neurophysiology in primates." \
  "https://sites.google.com/view/sliwa-group/people" \
  "https://parisbraininstitute.org/sites/default/files/styles/max_325x325/public/2025-01/julia-sliwa.png" \
  '[{"stringValue":"systems"},{"stringValue":"human"}]' \
  '[{"stringValue":"Paris Brain Institute (ICM)"}]' \
  "systems" "Paris Brain Institute (ICM)"

create_pi "Nikolas Karalis" \
  '[{"stringValue":"brain dynamics"},{"stringValue":"internal states"},{"stringValue":"neuromodulation"},{"stringValue":"neural oscillations"},{"stringValue":"electrophysiology"}]' \
  "ERC Starting Grant 2024. Studies the fundamental link between brain activity and neurotransmitter balance, exploring brain dynamics of internal states." \
  "https://www.neuronaldynamics.eu/" \
  "https://parisbraininstitute.org/sites/default/files/styles/max_325x325/public/2024-07/11_Nikolas%20Karalis.jpg" \
  '[{"stringValue":"systems"},{"stringValue":"computational"}]' \
  '[{"stringValue":"Paris Brain Institute (ICM)"}]' \
  "systems" "Paris Brain Institute (ICM)"

create_pi "Alberto Bacci" \
  '[{"stringValue":"cortical microcircuits"},{"stringValue":"GABAergic interneurons"},{"stringValue":"inhibition"},{"stringValue":"synaptic plasticity"},{"stringValue":"autapses"}]' \
  "Leads CircuitLab studying cellular physiology of cortical microcircuits. Investigates how interneurons carry out inhibition." \
  "https://baccilab.org/" \
  "https://parisbraininstitute.org/sites/default/files/styles/max_325x325/public/2024-10/boj_frm_abacci_426_crop_ctrst.jpg" \
  '[{"stringValue":"systems"}]' \
  '[{"stringValue":"Paris Brain Institute (ICM)"}]' \
  "systems" "Paris Brain Institute (ICM)"

create_pi "Nelson Rebola" \
  '[{"stringValue":"visual cortex"},{"stringValue":"synaptic physiology"},{"stringValue":"two-photon imaging"},{"stringValue":"circuit diversity"},{"stringValue":"sensory coding"}]' \
  "Studies how variability in synaptic function across neuronal types shapes sensory coding. Uses electrophysiology, two-photon imaging, and optogenetics." \
  "https://therebolalab.org/" \
  "https://parisbraininstitute.org/sites/default/files/styles/max_325x325/public/2024-07/13_30_NelsonRebola-2.gif" \
  '[{"stringValue":"systems"}]' \
  '[{"stringValue":"Paris Brain Institute (ICM)"}]' \
  "systems" "Paris Brain Institute (ICM)"

create_pi "Fabrizio De Vico Fallani" \
  '[{"stringValue":"brain networks"},{"stringValue":"network neuroscience"},{"stringValue":"brain-computer interfaces"},{"stringValue":"graph theory"},{"stringValue":"complex systems"}]' \
  "Leads the NERV team. Designs technologies for non-invasive brain-computer interfaces using complex network theory. ERC Consolidator Grant recipient." \
  "https://sites.google.com/site/devicofallanifabrizio/" \
  "https://parisbraininstitute.org/sites/default/files/styles/max_325x325/public/2025-10/fabrizio-de-vico-fallani_0.jpeg" \
  '[{"stringValue":"computational"}]' \
  '[{"stringValue":"Paris Brain Institute (ICM)"},{"stringValue":"INRIA Paris"}]' \
  "computational" "Paris Brain Institute (ICM)"

create_pi "Olivier Colliot" \
  '[{"stringValue":"machine learning"},{"stringValue":"neuroimaging"},{"stringValue":"neurodegenerative diseases"},{"stringValue":"deep learning"},{"stringValue":"medical image analysis"}]' \
  "Co-directs the ARAMIS Lab. Develops advanced computational and AI approaches for studying brain diseases from multimodal neuroimaging data. PRAIRIE AI chair holder." \
  "https://oliviercolliot.github.io/" \
  "https://parisbraininstitute.org/sites/default/files/styles/max_325x325/public/2024-07/13-30_Olivier%20Coliot.jpg" \
  '[{"stringValue":"computational"}]' \
  '[{"stringValue":"Paris Brain Institute (ICM)"},{"stringValue":"INRIA Paris"}]' \
  "computational" "Paris Brain Institute (ICM)"

create_pi "Ninon Burgos" \
  '[{"stringValue":"medical image computing"},{"stringValue":"deep learning"},{"stringValue":"neuroimaging"},{"stringValue":"anomaly detection"},{"stringValue":"computer-aided diagnosis"}]' \
  "CNRS Research Director co-heading ARAMIS Lab. Focuses on medical image analysis using machine learning for brain disease diagnosis. 2019 ERCIM Cor Baayen Award." \
  "https://ninonburgos.com/" \
  "https://parisbraininstitute.org/sites/default/files/styles/max_325x325/public/2025-01/burgos_ninon.jpg" \
  '[{"stringValue":"computational"}]' \
  '[{"stringValue":"Paris Brain Institute (ICM)"},{"stringValue":"INRIA Paris"}]' \
  "computational" "Paris Brain Institute (ICM)"

create_pi "Claire Wyart" \
  '[{"stringValue":"spinal cord"},{"stringValue":"sensorimotor integration"},{"stringValue":"zebrafish"},{"stringValue":"cerebrospinal fluid"},{"stringValue":"optogenetics"}]' \
  "Combines genetics, biophysics, and physiology to understand sensory integration in the spinal cord. Discovered cerebrospinal fluid-contacting neurons as mechanoreceptors. ERC grantee." \
  "https://wyartlab.org/" \
  "https://parisbraininstitute.org/sites/default/files/styles/max_325x325/public/2024-07/13-30_Claire_Wyart.JPG" \
  '[{"stringValue":"systems"}]' \
  '[{"stringValue":"Paris Brain Institute (ICM)"}]' \
  "systems" "Paris Brain Institute (ICM)"

create_pi "Thomas Andrillon" \
  '[{"stringValue":"sleep"},{"stringValue":"local sleep"},{"stringValue":"consciousness"},{"stringValue":"attention"},{"stringValue":"EEG"}]' \
  "ERC Starting Grant recipient for Sleeping Awake project. Studies how local sleep intrusions in the awake brain explain attention lapses and cognitive failures." \
  "https://thomas-andrillon.wixsite.com/research" \
  "https://parisbraininstitute.org/sites/default/files/styles/max_325x325/public/2024-07/andrillon-thomas-163x195.jpg" \
  '[{"stringValue":"human"},{"stringValue":"computational"}]' \
  '[{"stringValue":"Paris Brain Institute (ICM)"}]' \
  "human" "Paris Brain Institute (ICM)"

create_pi "Delphine Oudiette" \
  '[{"stringValue":"sleep"},{"stringValue":"dreams"},{"stringValue":"lucid dreaming"},{"stringValue":"creativity"},{"stringValue":"memory consolidation"}]' \
  "Studies how sleep and dreams impact cognitive functioning. Demonstrated real-time dialogue with lucid dreamers during REM sleep. ERC-funded CREADOZE project." \
  "https://parisbraininstitute.org/paris-brain-institute-research-teams/dreamteam-sleep-dreams-and-cognition" \
  "https://parisbraininstitute.org/sites/default/files/styles/max_325x325/public/2024-07/oudiette-delphine-163x195.jpg" \
  '[{"stringValue":"human"}]' \
  '[{"stringValue":"Paris Brain Institute (ICM)"}]' \
  "human" "Paris Brain Institute (ICM)"

create_pi "Liane Schmidt" \
  '[{"stringValue":"motivation"},{"stringValue":"interoception"},{"stringValue":"beliefs"},{"stringValue":"self-regulation"},{"stringValue":"placebo"}]' \
  "Founded the Control-Interoception-Attention team. Studies how beliefs, expectations, and self-suggestions influence motivation, decision-making, and interoception." \
  "https://sites.google.com/view/icm-cia-team/team-members" \
  "https://parisbraininstitute.org/sites/default/files/styles/max_325x325/public/2024-07/25_26_LianeSchmidt.jpg" \
  '[{"stringValue":"human"},{"stringValue":"computational"}]' \
  '[{"stringValue":"Paris Brain Institute (ICM)"}]' \
  "human" "Paris Brain Institute (ICM)"

create_pi "Jacobo Sitt" \
  '[{"stringValue":"consciousness"},{"stringValue":"disorders of consciousness"},{"stringValue":"neuroimaging"},{"stringValue":"complexity measures"},{"stringValue":"EEG"}]' \
  "Co-leads PICNIC Lab. Studies neural signatures of consciousness and develops computational tools for diagnosing disorders of consciousness." \
  "https://parisbraininstitute.org/collaborators/jacobo-sitt" \
  "https://parisbraininstitute.org/sites/default/files/styles/max_325x325/public/2024-07/sitt-jacobo.jpg" \
  '[{"stringValue":"computational"},{"stringValue":"human"}]' \
  '[{"stringValue":"Paris Brain Institute (ICM)"}]' \
  "computational" "Paris Brain Institute (ICM)"

create_pi "Nicolas Renier" \
  '[{"stringValue":"brain plasticity"},{"stringValue":"tissue clearing"},{"stringValue":"whole-brain mapping"},{"stringValue":"3D imaging"},{"stringValue":"iDISCO"}]' \
  "Develops and applies tissue clearing and 3D imaging techniques to study brain plasticity at whole-brain scale." \
  "https://www.renier-lab.com/" \
  "https://parisbraininstitute.org/sites/default/files/styles/max_325x325/public/2024-07/13-30_RENIER%20Nicolas.JPG" \
  '[{"stringValue":"systems"}]' \
  '[{"stringValue":"Paris Brain Institute (ICM)"}]' \
  "systems" "Paris Brain Institute (ICM)"

create_pi "Dafni Hadjieconomou" \
  '[{"stringValue":"gut-brain axis"},{"stringValue":"enteric nervous system"},{"stringValue":"Drosophila"},{"stringValue":"interoception"},{"stringValue":"physiology"}]' \
  "Studies gut-brain communication and the physiology of the enteric nervous system using Drosophila." \
  "https://parisbraininstitute.org/collaborators/dafni-hadjieconomou" \
  "https://parisbraininstitute.org/sites/default/files/styles/max_325x325/public/2024-07/07_10_Dafni_2023-10-16-SELECTION%20HD-BY%20SIMON%20CASSANAS-002.jpg" \
  '[{"stringValue":"systems"}]' \
  '[{"stringValue":"Paris Brain Institute (ICM)"}]' \
  "systems" "Paris Brain Institute (ICM)"

create_pi "Stanley Durrleman" \
  '[{"stringValue":"statistical learning"},{"stringValue":"disease progression modeling"},{"stringValue":"neurodegeneration"},{"stringValue":"differential geometry"},{"stringValue":"neuroinformatics"}]' \
  "INRIA Senior Research Scientist. Invented disease course mapping for personalised models of neurodegenerative disease progression. ERC Starting Grant recipient." \
  "https://who.rocq.inria.fr/Stanley.Durrleman/" \
  "" \
  '[{"stringValue":"computational"}]' \
  '[{"stringValue":"Paris Brain Institute (ICM)"},{"stringValue":"INRIA Paris"}]' \
  "computational" "Paris Brain Institute (ICM)"

create_pi "Marie-Constance Corsi" \
  '[{"stringValue":"brain-computer interfaces"},{"stringValue":"EEG"},{"stringValue":"neurophysiology"},{"stringValue":"BCI training"},{"stringValue":"network neuroscience"}]' \
  "INRIA research scientist in the NERV Lab. Develops tools to address BCI inefficiency. 2025 Early Career Award from the International BCI Society." \
  "https://marieconstance-corsi.netlify.app/" \
  "" \
  '[{"stringValue":"computational"}]' \
  '[{"stringValue":"Paris Brain Institute (ICM)"},{"stringValue":"INRIA Paris"}]' \
  "computational" "Paris Brain Institute (ICM)"

create_pi "Brian Lau" \
  '[{"stringValue":"basal ganglia"},{"stringValue":"deep brain stimulation"},{"stringValue":"motor control"},{"stringValue":"electrophysiology"},{"stringValue":"neurofeedback"}]' \
  "Co-leader of the NEURXP team. Studies the role of basal ganglia in movement and cognitive control, combining research in animal models with clinical DBS investigations." \
  "https://parisbraininstitute.org/collaborators/lau-brian" \
  "" \
  '[{"stringValue":"systems"},{"stringValue":"computational"}]' \
  '[{"stringValue":"Paris Brain Institute (ICM)"}]' \
  "systems" "Paris Brain Institute (ICM)"

# ==================== Institut Pasteur ====================

create_pi "Pierre-Marie Lledo" \
  '[{"stringValue":"olfaction"},{"stringValue":"adult neurogenesis"},{"stringValue":"sensory perception"},{"stringValue":"neural circuits"},{"stringValue":"plasticity"}]' \
  "Chair of the Neuroscience Department at Institut Pasteur. Leads Perception and Action team studying sensory perception and motor control, particularly olfactory processing." \
  "https://research.pasteur.fr/en/team/perception-and-action/" \
  "" \
  '[{"stringValue":"systems"}]' \
  '[{"stringValue":"Institut Pasteur"}]' \
  "systems" "Institut Pasteur"

create_pi "Thomas Bourgeron" \
  '[{"stringValue":"autism"},{"stringValue":"synapse genetics"},{"stringValue":"SHANK3"},{"stringValue":"cognitive functions"},{"stringValue":"circadian rhythms"}]' \
  "Discovered the first synaptic mutations in autism (NLGN3, NLGN4X, SHANK3). Leads Human Genetics and Cognitive Functions Unit performing large-scale genomic profiling of ASD families." \
  "https://research.pasteur.fr/en/team/human-genetics-and-cognitive-functions/" \
  "" \
  '[{"stringValue":"human"}]' \
  '[{"stringValue":"Institut Pasteur"}]' \
  "human" "Institut Pasteur"

create_pi "Roberto Toro" \
  '[{"stringValue":"neuroanatomy"},{"stringValue":"brain morphology"},{"stringValue":"computational anatomy"},{"stringValue":"brain evolution"},{"stringValue":"morphometry"}]' \
  "Heads Applied and Theoretical Neuroanatomy unit. Develops mathematical models of brain development and computational neuroanatomy tools." \
  "https://neuroanatomy.github.io/people.html" \
  "" \
  '[{"stringValue":"computational"}]' \
  '[{"stringValue":"Institut Pasteur"}]' \
  "computational" "Institut Pasteur"

create_pi "Jean-Baptiste Masson" \
  '[{"stringValue":"Bayesian computation"},{"stringValue":"decision-making"},{"stringValue":"stochastic processes"},{"stringValue":"Drosophila larva"},{"stringValue":"embodied neuroAI"}]' \
  "Leads Decision and Bayesian Computation (Epimethee) team. Theoretical physicist studying biological intelligence through Bayesian inference in Drosophila larva brain. PRAIRIE Chair holder." \
  "https://research.pasteur.fr/en/member/jean-baptiste-masson/" \
  "https://www.prairie-psai.fr/app/uploads/2019/11/Jean-Baptiste-Masson-1.jpg" \
  '[{"stringValue":"computational"}]' \
  '[{"stringValue":"Institut Pasteur"}]' \
  "computational" "Institut Pasteur"

create_pi "Florent Haiss" \
  '[{"stringValue":"barrel cortex"},{"stringValue":"decision-making"},{"stringValue":"somatosensory"},{"stringValue":"two-photon imaging"},{"stringValue":"optogenetics"}]' \
  "Leads Neural Circuit Dynamics and Decision Making unit. Uses two-photon/three-photon imaging, multi-electrode recordings, and optogenetics to study cortical activity during decisions." \
  "https://research.pasteur.fr/en/team/neural-circuit-dynamics-and-decision-making/" \
  "" \
  '[{"stringValue":"systems"}]' \
  '[{"stringValue":"Institut Pasteur"}]' \
  "systems" "Institut Pasteur"

create_pi "Aleksandra Deczkowska" \
  '[{"stringValue":"neuroimmunology"},{"stringValue":"microglia"},{"stringValue":"choroid plexus"},{"stringValue":"brain-immune communication"},{"stringValue":"aging"}]' \
  "Heads Brain Immune Communication Lab. Studies how immune cells and signals shape brain development, activity, and aging. ERC Starting Grant 2022." \
  "https://research.pasteur.fr/en/team/brain-immune-communication/" \
  "" \
  '[{"stringValue":"systems"}]' \
  '[{"stringValue":"Institut Pasteur"}]' \
  "systems" "Institut Pasteur"

create_pi "Brice Bathellier" \
  '[{"stringValue":"auditory cortex"},{"stringValue":"multisensory perception"},{"stringValue":"neural dynamics"},{"stringValue":"population coding"},{"stringValue":"computational principles"}]' \
  "Studies computational principles for processing auditory and multisensory information. CNRS Research Director at the Institut de l Audition." \
  "https://sites.google.com/bathellier-lab.org/bathellier-lab/" \
  "" \
  '[{"stringValue":"systems"},{"stringValue":"computational"}]' \
  '[{"stringValue":"Institut de l'\''Audition"}]' \
  "systems" "Institut de l'Audition"

create_pi "Anne-Lise Giraud" \
  '[{"stringValue":"speech processing"},{"stringValue":"neural oscillations"},{"stringValue":"auditory cortex"},{"stringValue":"hearing"},{"stringValue":"neural coding"}]' \
  "Director of the Hearing Institute (Institut de l Audition). Studies neural computations enabling speech perception and production." \
  "https://research.pasteur.fr/en/team/neural-coding-and-engineering-of-human-speech-functions/" \
  "" \
  '[{"stringValue":"human"},{"stringValue":"computational"}]' \
  '[{"stringValue":"Institut de l'\''Audition"}]' \
  "human" "Institut de l'Audition"

# ==================== ESPCI Paris ====================

create_pi "Karim Benchenane" \
  '[{"stringValue":"memory"},{"stringValue":"sleep"},{"stringValue":"hippocampus"},{"stringValue":"brain oscillations"},{"stringValue":"optogenetics"}]' \
  "CNRS Research Director leading MOBS team. Demonstrated causal role of place cells in navigation by creating explicit memories during sleep via optogenetic stimulation." \
  "https://benchenanelab.com/" \
  "" \
  '[{"stringValue":"systems"}]' \
  '[{"stringValue":"ESPCI Paris"}]' \
  "systems" "ESPCI Paris"

create_pi "Gisella Vetere" \
  '[{"stringValue":"memory engrams"},{"stringValue":"neural circuits"},{"stringValue":"optogenetics"},{"stringValue":"whole-brain imaging"},{"stringValue":"memory consolidation"}]' \
  "Leads C4 team studying memory formation and consolidation. Implanted artificial odor memories and deconstructed memory engrams using cutting-edge techniques." \
  "https://veterelab.weebly.com/" \
  "" \
  '[{"stringValue":"systems"}]' \
  '[{"stringValue":"ESPCI Paris"}]' \
  "systems" "ESPCI Paris"

create_pi "Philippe Faure" \
  '[{"stringValue":"dopamine"},{"stringValue":"nicotine"},{"stringValue":"addiction"},{"stringValue":"reward"},{"stringValue":"decision-making"}]' \
  "Studies decision-making mechanisms and nicotine addiction. Discovered how nicotine drives opposite responses in distinct VTA dopamine neuron populations." \
  "https://faurelab.cnrs.fr/" \
  "" \
  '[{"stringValue":"systems"}]' \
  '[{"stringValue":"ESPCI Paris"}]' \
  "systems" "ESPCI Paris"

create_pi "Mickael Tanter" \
  '[{"stringValue":"functional ultrasound imaging"},{"stringValue":"brain imaging"},{"stringValue":"ultrafast ultrasound"},{"stringValue":"neurovascular coupling"}]' \
  "Co-invented functional ultrasound brain imaging (fUS). ERC Advanced Grant recipient. Over 300 publications and 50 patents. Elected to French Academy of Sciences." \
  "https://www.physicsformedicine.espci.fr/" \
  "" \
  '[{"stringValue":"systems"},{"stringValue":"computational"}]' \
  '[{"stringValue":"ESPCI Paris"}]' \
  "systems" "ESPCI Paris"

# ==================== College de France ====================

create_pi "Stanislas Dehaene" \
  '[{"stringValue":"consciousness"},{"stringValue":"number cognition"},{"stringValue":"reading"},{"stringValue":"global neuronal workspace"},{"stringValue":"brain imaging"}]' \
  "Elucidates biological mechanisms of human perception and cognition. Pioneer of number sense and visual word form area research. Co-developed Global Neuronal Workspace theory. Brain Prize 2014." \
  "https://www.college-de-france.fr/en/chair/stanislas-dehaene-experimental-cognitive-psychology-statutory-chair" \
  "https://www.edge.org/sites/default/files/styles/member-photo/public/member-pictures/picture-47-1517505912.jpg" \
  '[{"stringValue":"human"},{"stringValue":"computational"}]' \
  '[{"stringValue":"College de France"},{"stringValue":"CEA NeuroSpin"}]' \
  "human" "College de France"

# ==================== CEA NeuroSpin ====================

create_pi "Ghislaine Dehaene-Lambertz" \
  '[{"stringValue":"infant brain development"},{"stringValue":"language acquisition"},{"stringValue":"fMRI"},{"stringValue":"neural architecture"},{"stringValue":"neonatal cognition"}]' \
  "Pediatrician and cognitive scientist. Pioneer in brain imaging of infants. Studies neural architecture enabling language acquisition in infant brains." \
  "https://www.unicog.org/" \
  "https://cdn-ilakmbb.nitrocdn.com/jIYMIjeZjxbibSovbmtXtpmbltiBOKUt/assets/images/optimized/rev-d2b9beb/cerveau-enfant.org/wp-content/uploads/2024/05/Ghislaine-Dehaene-Lambertz-300x300.jpg" \
  '[{"stringValue":"human"}]' \
  '[{"stringValue":"CEA NeuroSpin"}]' \
  "human" "CEA NeuroSpin"

create_pi "Florent Meyniel" \
  '[{"stringValue":"uncertainty"},{"stringValue":"Bayesian inference"},{"stringValue":"confidence"},{"stringValue":"sequence learning"},{"stringValue":"fMRI"}]' \
  "Research Director at NeuroSpin leading the Computational Brain team. Studies how the brain estimates uncertainty and how confidence regulates learning. ERC Starting Grant recipient." \
  "https://florentmeyniel.weebly.com/" \
  "" \
  '[{"stringValue":"computational"},{"stringValue":"human"}]' \
  '[{"stringValue":"CEA NeuroSpin"}]' \
  "computational" "CEA NeuroSpin"

create_pi "Virginie van Wassenhove" \
  '[{"stringValue":"temporal cognition"},{"stringValue":"multisensory integration"},{"stringValue":"neural oscillations"},{"stringValue":"MEG"},{"stringValue":"time perception"}]' \
  "INSERM Team Leader at NeuroSpin. Created the Cognition and Brain Dynamics lab. Studies temporal cognition and whether neural oscillations define moments for time perception." \
  "https://brainthemind.com/" \
  "" \
  '[{"stringValue":"computational"},{"stringValue":"human"}]' \
  '[{"stringValue":"CEA NeuroSpin"}]' \
  "computational" "CEA NeuroSpin"

create_pi "Bertrand Thirion" \
  '[{"stringValue":"machine learning"},{"stringValue":"neuroimaging"},{"stringValue":"statistical modeling"},{"stringValue":"brain mapping"},{"stringValue":"scikit-learn"}]' \
  "INRIA Senior Researcher leading the Parietal team at NeuroSpin. Develops statistics and machine learning for brain imaging. Major contributor to nilearn and scikit-learn." \
  "https://pages.saclay.inria.fr/bertrand.thirion/" \
  "" \
  '[{"stringValue":"computational"}]' \
  '[{"stringValue":"CEA NeuroSpin"},{"stringValue":"INRIA Paris"}]' \
  "computational" "CEA NeuroSpin"

create_pi "Sophie Herbst" \
  '[{"stringValue":"temporal predictions"},{"stringValue":"Bayesian modeling"},{"stringValue":"auditory processing"},{"stringValue":"EEG"},{"stringValue":"MEG"}]' \
  "Researcher at NeuroSpin studying how temporal predictions are formed from sensory statistics using Bayesian models and neural oscillation methods." \
  "https://brainthemind.com/sophie-herbst/" \
  "" \
  '[{"stringValue":"computational"},{"stringValue":"human"}]' \
  '[{"stringValue":"CEA NeuroSpin"}]' \
  "computational" "CEA NeuroSpin"

# ==================== NeuroPSI (Paris-Saclay) ====================

create_pi "Daniel Shulz" \
  '[{"stringValue":"barrel cortex"},{"stringValue":"whisker somatosensory system"},{"stringValue":"sensory processing"},{"stringValue":"tactile encoding"}]' \
  "Heads Sensorimotor Integration and Plasticity lab and the Department of Integrative and Computational Neuroscience at NeuroPSI." \
  "https://neuropsi.cnrs.fr/en/daniel-shulz-translated/" \
  "" \
  '[{"stringValue":"systems"}]' \
  '[{"stringValue":"NeuroPSI (Paris-Saclay)"}]' \
  "systems" "NeuroPSI (Paris-Saclay)"

create_pi "Tihana Jovanic" \
  '[{"stringValue":"Drosophila larva"},{"stringValue":"sensorimotor decisions"},{"stringValue":"neural circuits"},{"stringValue":"action sequences"},{"stringValue":"behavior"}]' \
  "Group Leader of Neural Circuits and Behavior at NeuroPSI. Uses Drosophila genetic tools to study neural circuits for sensorimotor decisions and action sequences." \
  "https://neuropsi.cnrs.fr/en/departments/cnn/group-leader-tihana-jovanic/" \
  "" \
  '[{"stringValue":"systems"},{"stringValue":"computational"}]' \
  '[{"stringValue":"NeuroPSI (Paris-Saclay)"}]' \
  "systems" "NeuroPSI (Paris-Saclay)"

# ==================== Universite Paris Cite ====================

create_pi "Laura Dugue" \
  '[{"stringValue":"brain oscillations"},{"stringValue":"perception"},{"stringValue":"attention"},{"stringValue":"traveling waves"},{"stringValue":"TMS"}]' \
  "Full Professor of Cognitive and Computational Neuroscience at INCC. Studies spatio-temporal organization of brain oscillations and their role in perception. ERC Starting Grant recipient." \
  "https://www.duguelab.com/" \
  "" \
  '[{"stringValue":"computational"},{"stringValue":"human"}]' \
  '[{"stringValue":"INCC - Universite Paris Cite"}]' \
  "computational" "INCC - Universite Paris Cite"

create_pi "Claire Sergent" \
  '[{"stringValue":"consciousness"},{"stringValue":"conscious perception"},{"stringValue":"global workspace"},{"stringValue":"EEG"},{"stringValue":"computational modelling"}]' \
  "Professor of Cognitive Neuroscience. ERC Consolidator Grant for CONSCIOUSBRAIN project studying the core mechanisms of conscious processing." \
  "https://sergent-consciousness-lab.u-paris.fr/" \
  "" \
  '[{"stringValue":"human"},{"stringValue":"computational"}]' \
  '[{"stringValue":"INCC - Universite Paris Cite"}]' \
  "human" "INCC - Universite Paris Cite"

create_pi "Belen Pardi" \
  '[{"stringValue":"sensory perception"},{"stringValue":"neocortical circuits"},{"stringValue":"learning"},{"stringValue":"top-down signaling"},{"stringValue":"zona incerta"}]' \
  "Identifies key neuronal circuits for sensory perception and memory. Discovered zona incerta as a major source of top-down input to neocortex with learning-related plasticity." \
  "https://sites.google.com/view/pardi-lab/presentation" \
  "" \
  '[{"stringValue":"systems"}]' \
  '[{"stringValue":"IPNP - Universite Paris Cite"}]' \
  "systems" "IPNP - Universite Paris Cite"

create_pi "David Hansel" \
  '[{"stringValue":"neural network theory"},{"stringValue":"cortical dynamics"},{"stringValue":"balanced networks"},{"stringValue":"working memory"},{"stringValue":"irregular activity"}]' \
  "Computational neuroscientist at SPPIN/INCC. Pioneering work with van Vreeswijk on how balanced networks can produce strong selectivity from weakly modulated inputs." \
  "https://incc-paris.fr/people/david-hansel/" \
  "" \
  '[{"stringValue":"computational"}]' \
  '[{"stringValue":"SPPIN - Universite Paris Cite"}]' \
  "computational" "SPPIN - Universite Paris Cite"

create_pi "Michael Graupner" \
  '[{"stringValue":"synaptic plasticity"},{"stringValue":"calcium-based models"},{"stringValue":"cerebellar motor control"},{"stringValue":"neural network dynamics"}]' \
  "CNRS Research Scientist at SPPIN. Leads research on computational synaptic plasticity, particularly the Graupner-Brunel calcium-based model." \
  "https://www.sppin.fr/members/michael-graupner/" \
  "" \
  '[{"stringValue":"computational"}]' \
  '[{"stringValue":"SPPIN - Universite Paris Cite"}]' \
  "computational" "SPPIN - Universite Paris Cite"

create_pi "Desdemona Fricker" \
  '[{"stringValue":"head direction system"},{"stringValue":"spatial orientation"},{"stringValue":"presubiculum"},{"stringValue":"hippocampus"},{"stringValue":"electrophysiology"}]' \
  "CNRS Research Director at SPPIN. Studies neural basis of spatial orientation coding, defining the presubicular microcircuit at the core of the head direction system." \
  "https://www.sppin.fr/members/desdemona-fricker/" \
  "" \
  '[{"stringValue":"systems"}]' \
  '[{"stringValue":"SPPIN - Universite Paris Cite"}]' \
  "systems" "SPPIN - Universite Paris Cite"

create_pi "Fani Koukouli" \
  '[{"stringValue":"cholinergic modulation"},{"stringValue":"nicotinic receptors"},{"stringValue":"cortical inhibitory circuits"},{"stringValue":"neurodegeneration"},{"stringValue":"prefrontal cortex"}]' \
  "Group Leader at IPNP. Studies cholinergic modulation of cortical inhibitory circuits in neurodegenerative and psychiatric disorders. ATIP-Avenir and L Oreal-UNESCO fellow." \
  "https://ipnp.paris5.inserm.fr/research/teams-and-projects" \
  "" \
  '[{"stringValue":"systems"}]' \
  '[{"stringValue":"IPNP - Universite Paris Cite"}]' \
  "systems" "IPNP - Universite Paris Cite"

# ==================== Sorbonne / Institut de la Vision ====================

create_pi "Mehdi Khamassi" \
  '[{"stringValue":"reinforcement learning"},{"stringValue":"decision-making"},{"stringValue":"robotics"},{"stringValue":"basal ganglia"},{"stringValue":"social learning"}]' \
  "CNRS Research Director at ISIR. Double background in AI and cognitive science. Studies decision-making and reinforcement learning in humans and robots." \
  "https://pages2.isir.upmc.fr/mkhamassi/" \
  "https://www.isir.upmc.fr/wp-content/uploads/2021/06/pict20210624_162208_0-copie-1-300x300.jpg" \
  '[{"stringValue":"computational"}]' \
  '[{"stringValue":"ISIR - Sorbonne Universite"}]' \
  "computational" "ISIR - Sorbonne Universite"

create_pi "Romain Brette" \
  '[{"stringValue":"spiking neural networks"},{"stringValue":"action potentials"},{"stringValue":"neural coding"},{"stringValue":"Brian simulator"},{"stringValue":"sensory systems"}]' \
  "Research Director studying computational and theoretical neuroscience of sensory systems. Co-created the Brian spiking neural network simulator." \
  "https://romainbrette.fr/" \
  "" \
  '[{"stringValue":"computational"}]' \
  '[{"stringValue":"Institut de la Vision"}]' \
  "computational" "Institut de la Vision"

create_pi "Ulisse Ferrari" \
  '[{"stringValue":"retinal encoding"},{"stringValue":"neural correlations"},{"stringValue":"population coding"},{"stringValue":"statistical physics"},{"stringValue":"optogenetics"}]' \
  "Researcher at Institut de la Vision. Studies collective behavior of neurons and how neuronal networks encode information in the retina using statistical physics methods." \
  "https://www.institut-vision.org/en/" \
  "" \
  '[{"stringValue":"computational"}]' \
  '[{"stringValue":"Institut de la Vision"}]' \
  "computational" "Institut de la Vision"

# ==================== ENS - IBENS ====================

create_pi "Jonas Ranft" \
  '[{"stringValue":"statistical physics"},{"stringValue":"neural circuits"},{"stringValue":"synaptic structure"},{"stringValue":"oscillations"},{"stringValue":"dynamical systems"}]' \
  "CNRS Research Fellow at IBENS. Uses methods from statistical physics and dynamical systems to study neural network dynamics and synaptic structure." \
  "https://qbio.ens.psl.eu/en/people/jonas-ranft" \
  "" \
  '[{"stringValue":"computational"}]' \
  '[{"stringValue":"IBENS - ENS"}]' \
  "computational" "IBENS - ENS"

create_pi "Vincent Villette" \
  '[{"stringValue":"voltage imaging"},{"stringValue":"two-photon microscopy"},{"stringValue":"inhibitory circuits"},{"stringValue":"hippocampus"},{"stringValue":"optical methods"}]' \
  "CNRS Research Fellow at IBENS. Develops advanced optical methods for measuring electrical activity in neurons. Co-developed ASAP3 voltage indicator. CNRS Bronze Medal 2021." \
  "https://www.bio.ens.psl.eu/depbio/" \
  "" \
  '[{"stringValue":"systems"}]' \
  '[{"stringValue":"IBENS - ENS"}]' \
  "systems" "IBENS - ENS"

create_pi "Lucie Berkovitch" \
  '[{"stringValue":"consciousness"},{"stringValue":"psychedelics"},{"stringValue":"schizophrenia"},{"stringValue":"computational psychiatry"},{"stringValue":"psilocybin"}]' \
  "Junior Professor at ENS/PSL. Psychiatrist and neuroscientist studying consciousness alterations in psychiatric disorders and under psychedelic substances. PI of Frances first psilocybin trial." \
  "https://cognition.ens.fr" \
  "" \
  '[{"stringValue":"computational"},{"stringValue":"human"}]' \
  '[{"stringValue":"ENS - Ecole Normale Superieure"}]' \
  "computational" "ENS - Ecole Normale Superieure"

# ==================== Jean-Remi King ====================

create_pi "Jean-Remi King" \
  '[{"stringValue":"AI and the brain"},{"stringValue":"language models"},{"stringValue":"neural decoding"},{"stringValue":"MEG"},{"stringValue":"deep learning"}]' \
  "CNRS researcher and Meta AI scientist. Studies unexpected similarities between AI systems and the brain, focusing on language processing and neural decoding." \
  "https://kingjr.github.io/" \
  "https://kingjr.github.io/images/profile.png" \
  '[{"stringValue":"computational"},{"stringValue":"human"}]' \
  '[{"stringValue":"ENS - Ecole Normale Superieure"}]' \
  "computational" "ENS - Ecole Normale Superieure"

echo ""
echo "=== Done ==="
echo "Seeded ~60 PIs and 15 institutes into Firestore."
echo ""
echo "Note: Some PIs may be duplicates if you already had entries."
echo "Review and manage entries via the admin panel on the website."
