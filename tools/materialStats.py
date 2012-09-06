import json
import sys
import os


def overwriteConsole(s):
    sys.stdout.write('\r')
    sys.stdout.write(s)
    sys.stdout.flush()

def accumNumMats(modelID, modelJSON, numMatsHist):
    numMats = len(modelJSON['materials'])
    if numMats not in numMatsHist:
        numMatsHist[numMats] = [1, modelID]
    else:
        numMatsHist[numMats][0] += 1
        
def reportNumMats(numMatsHist):
    f = open('numMatsHist.csv', 'w')
    for num in numMatsHist:
        f.write('{0},{1},{2}\n'.format(num, numMatsHist[num][0], numMatsHist[num][1]))
    f.close()

def computeStats(modelDir):
    
    modelDir = modelDir.strip('/').strip('\\')
    modelFiles = os.listdir(modelDir)
    numModels = len(modelFiles)
    
    # Stat aggregation structures
    numMatsHist = {}
    
    # Do aggregation
    modelsDone = 0
    for mfile in modelFiles:
        
        mid = mfile.strip('.json')
        fullpath = '{0}/{1}'.format(modelDir, mfile)
        f = open(fullpath, 'r')
        s = f.read();
        f.close();
        try:
            jsonObj = json.loads(s);
        except ValueError:
            print '\nFatal Error: Could not parse JSON from file {}'.format(fullpath)
            sys.exit(1)
        
        accumNumMats(mid, jsonObj, numMatsHist)
        
        modelsDone += 1
        overwriteConsole('Aggregated statistics for model {0}/{1}'.format(modelsDone, numModels))
        
    # Spit out report files
    reportNumMats(numMatsHist)
    
    print('\nDone')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print 'usage: materialStats <database model directory>'
        sys.exit(1)
    computeStats(sys.argv[1])