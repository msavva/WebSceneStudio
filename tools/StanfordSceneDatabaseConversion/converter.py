import os
import sys
import shutil
import subprocess
import json
import httplib

'''
Globals
'''
objcompressDir = '../webgl-loader/obj2utf8/Release'
dataDir = '../../data'
sceneStudioDatabaseHost = 'dovahkiin.stanford.edu'
sceneImagesDir = '/SceneModeling/Database/SceneImagesB'
stanfordSceneDatabase = None

modelDir = dataDir + '/model'
geomDir = dataDir + '/geometry'
texDir = dataDir + '/texture'
metaDir = dataDir + '/metadata'
imgDir = dataDir + '/image'

maxAllowedOBJsize_MB = 50;

LOG = None


'''
Write something to stdout and to the global log file
'''
def LogWrite(msg):
    if msg:
        print(msg)
        LOG.write(msg + '\n')

'''
Ensure data directories exist
'''
def CheckedMkdir(path):
    if not os.path.exists(path):
        os.mkdir(path)
def EnsureDataDirectoriesExist():
    CheckedMkdir(dataDir)
    CheckedMkdir(modelDir)
    CheckedMkdir(geomDir)
    CheckedMkdir(texDir)
    CheckedMkdir(metaDir)
    CheckedMkdir(imgDir)
    
'''
Delete all traces of a model from the data directory
'''
def CheckedRemove(path):
    if os.path.exists(path):
        if os.path.isdir(path):
            shutil.rmtree(path)
        else:
            os.remove(path)
def DeleteModel(modelid):
    modelpath = '{thedir}/{mid}.json'.format(thedir=modelDir, mid=modelid)
    metapath =  '{thedir}/{mid}.json'.format(thedir=metaDir, mid=modelid)
    geompath = '{thedir}/{mid}.utf8'.format(thedir=geomDir, mid=modelid)
    imgpath = '{thedir}/{mid}.jpg'.format(thedir=imgDir, mid=modelid)
    CheckedRemove(modelpath)
    CheckedRemove(metapath)
    CheckedRemove(geompath)
    CheckedRemove(imgpath)
    
'''
objcompress the objs and write the results to the data directory
'''
def CompressModel(modelid):
    
    ## First, copy the .obj and .mtl to the same directory as objcompress    
    inObjPath = '{thedir}/models/{theid}.obj'.format(thedir=stanfordSceneDatabase, theid=modelid)
    inMtlPath = '{thedir}/models/{theid}.mtl'.format(thedir=stanfordSceneDatabase, theid=modelid)
    outObjPath = '{thedir}/{theid}.obj'.format(thedir=objcompressDir, theid=modelid)
    outMtlPath = '{thedir}/{theid}.mtl'.format(thedir=objcompressDir, theid=modelid)
    shutil.copyfile(inObjPath, outObjPath)
    shutil.copyfile(inMtlPath, outMtlPath)
    
    ## Do the compression
    cwd = os.getcwd()
    errfile = open('err.txt', 'w+')
    jsonoutput = None
    try:
        os.chdir(objcompressDir)
        subprocess.call(['obj2utf8', modelid + '.obj', modelid + '.utf8', modelid + '.json'], stderr=errfile)
    except subprocess.CalledProcessError:
        LogWrite('ERROR: obj2utf8 died:')
        ## Clean up any .utf8's left lying around
        utf8Files = [item for item in os.listdir('.') if item.endswith('.utf8')]
        for utf8 in utf8Files:
            os.remove(utf8)
        ## Remove any other traces of this model
        DeleteModel(modelid)
        return
    finally:
        os.chdir(cwd)
        # Grab contents of and then delete the temporary error file
        errfile.seek(0)
        LogWrite(errfile.read())
        errfile.close()
        os.remove('err.txt')
        ## Delete the temporary .obj and .mtl
        os.remove('{thedir}/{theid}.obj'.format(thedir=objcompressDir, theid=modelid))
        os.remove('{thedir}/{theid}.mtl'.format(thedir=objcompressDir, theid=modelid))
        
    ## Move the .utf8 to its final destination folder
    utf8_inpath = '{thedir}/{theid}.utf8'.format(thedir=objcompressDir, theid=modelid)
    utf8_outpath = '{thedir}/{theid}.utf8'.format(thedir=geomDir, theid=modelid)
    shutil.move(utf8_inpath, utf8_outpath)
        
    ## Move the .json file to its final destination folder
    json_inpath = '{thedir}/{theid}.json'.format(thedir=objcompressDir, theid=modelid)
    json_outpath = '{thedir}/{theid}.json'.format(thedir=modelDir, theid=modelid)
    shutil.move(json_inpath, json_outpath)
    
    
'''
Downloads representative image for a model
'''
def DownloadImage(modelid):
    outpath = '{thedir}/{mid}.jpg'.format(thedir=imgDir, mid=modelid)
    if os.path.exists(outpath):
        return
    conn = httplib.HTTPConnection(sceneStudioDatabaseHost)
    conn.request('GET', '{thedir}/{mid}.jpg'.format(thedir=sceneImagesDir, mid=modelid))
    r = conn.getresponse()
    if r.status != 200:
        LogWrite('ERROR: Could not download representative image (continuing anyway)')
        return
    data = r.read()
    imgf = open(outpath, 'wb')
    imgf.write(data)
    imgf.close()
    

    
'''
Copy over textures used by the models we're converting
'''
def CopyTextures():
    tDir = '{thedir}/models/textures'.format(thedir=stanfordSceneDatabase)
    texFiles = os.listdir(tDir)
    for tex in texFiles:
        inpath = '{thedir}/{thetex}'.format(thedir=tDir, thetex=tex)
        outpath = '{thedir}/{thetex}'.format(thedir=texDir, thetex=tex)
        if not os.path.exists(outpath):
            shutil.copyfile(inpath, outpath)
    

'''
Load in the names and tags, convert them into JSON for
long-term metadata storage
'''
def ConvertAllMetadata(oversized):
    nameFile = open('{thedir}/fields/names.txt'.format(thedir=stanfordSceneDatabase), 'r')
    tagFile = open('{thedir}/fields/tags.txt'.format(thedir=stanfordSceneDatabase), 'r')
    nameLines = nameFile.readlines()
    tagLines = tagFile.readlines()
    nameFile.close()
    tagFile.close()
    
    ## Put everything in a dictionary
    alldata = {};
    for line in nameLines:
        tokens = line.split('|')
        mid = tokens[0].strip()
        mname = tokens[1].strip()
        alldata[mid] = {'id' : mid, 'name' : mname}
    for line in tagLines:
        tokens = line.split('|')
        mid = tokens[0].strip();
        tags = tokens[1:]
        if len(tags) > 0:
            tags[-1] = tags[-1].strip()
        alldata[mid]['tags'] = tags;
        
    ## Write a JSON file for each model
    ## (but only if it is not in the oversized list)
    for mid in alldata:
        if mid not in oversized:
            jsonFile = open('{thedir}/{theid}.json'.format(thedir=metaDir, theid=mid), 'w')
            jsonFile.write(json.dumps(alldata[mid]))
            jsonFile.close()


def OversizedModelIDs(modelids):
    modeldir = '{thedir}/models/'.format(thedir=stanfordSceneDatabase);
    retlist = [mid for mid in modelids if os.path.getsize(modeldir + mid + '.obj') >= (maxAllowedOBJsize_MB * 1000000)]
    return retlist


def FilterModelIDs(modelids):
    # Filter out models that we've already converted.
    existing = [fname[0:-5] for fname in os.listdir(modelDir) if fname.endswith('.json')]
    retlist = [mid for mid in modelids if mid not in existing]
    # Also filter out any models that are bigger than the allowed maximum.
    oversized = OversizedModelIDs(retlist)
    retlist = [mid for mid in retlist if mid not in oversized]
    return retlist;


## Main function
if __name__ == '__main__':
    
    if len(sys.argv) < 2:
        print('Usage: convert <location_of_stanford_scene_database>')
        sys.exit()
        
    stanfordSceneDatabase = sys.argv[1].strip('/')
    
    LOG = open('log.txt', 'w')
    LogWrite('Ensuring directories exist...')
    EnsureDataDirectoriesExist()
    LogWrite('Copying textures...')
    CopyTextures()
    modeldir = '{thedir}/models'.format(thedir=stanfordSceneDatabase);
    modelids = [fname[0:-4] for fname in os.listdir(modeldir) if fname.endswith('.obj')]
    LogWrite('Converting metadata...')
    ConvertAllMetadata(OversizedModelIDs(modelids))
    modelids = FilterModelIDs(modelids)
    for mid in modelids:
        LogWrite('--------------------------------------')
        LogWrite('Converting model {model}...'.format(model=mid))
        CompressModel(mid)
        DownloadImage(mid)
    LOG.close()

